const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SERVICE = "DailyWallpaperGen";

function fallbackKey() {
  return crypto.createHash("sha256").update(`${os.userInfo().username}:${os.hostname()}:${SERVICE}`).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", fallbackKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(value) {
  const buffer = Buffer.from(value, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", fallbackKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function createSecretStore(app, logger) {
  const fallbackPath = path.join(app.getPath("userData"), "secrets.json");
  let keytarPromise = null;

  async function loadKeytar() {
    if (!keytarPromise) {
      keytarPromise = import("keytar")
        .then((module) => module.default || module)
        .catch((error) => {
          logger.warn("Keychain storage unavailable; using encrypted local fallback.", { error: error.message });
          return null;
        });
    }
    return keytarPromise;
  }

  function readFallback() {
    if (!fs.existsSync(fallbackPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
  }

  function writeFallback(data) {
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  return {
    async get(provider) {
      const keytar = await loadKeytar();
      if (keytar) {
        const value = await keytar.getPassword(SERVICE, provider);
        if (value) return value;
      }

      const data = readFallback();
      return data[provider] ? decrypt(data[provider]) : "";
    },

    async set(provider, value) {
      const keytar = await loadKeytar();
      if (keytar) {
        await keytar.setPassword(SERVICE, provider, value);
        return;
      }

      const data = readFallback();
      if (value) {
        data[provider] = encrypt(value);
      } else {
        delete data[provider];
      }
      writeFallback(data);
    },

    async has(provider) {
      return Boolean(await this.get(provider));
    }
  };
}

module.exports = {
  createSecretStore
};
