const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_SETTINGS, PROVIDERS } = require("./defaultSettings");

function createSettingsStore(app) {
  const filePath = path.join(app.getPath("userData"), "settings.json");
  let data = { settings: { ...DEFAULT_SETTINGS } };

  function load() {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      data = {
        ...data,
        ...parsed,
        settings: {
          ...DEFAULT_SETTINGS,
          ...parsed.settings
        }
      };
    }
  }

  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  load();

  return {
    get(key) {
      return data[key];
    },
    set(key, value) {
      data[key] = value;
      save();
    },
    filePath,
    save
  };
}

function validateSettings(input) {
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const errors = [];

  if (!PROVIDERS[settings.provider]) errors.push("Choose a supported provider.");
  if (!settings.model.trim()) errors.push("Model is required.");
  if (!settings.prompt.trim()) errors.push("Prompt is required.");
  if (!/^([1-9]\d{2,4})x([1-9]\d{2,4})$/.test(settings.resolution)) errors.push("Resolution must look like 1920x1080.");
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(settings.scheduleTime)) errors.push("Schedule time must be HH:MM.");
  if (settings.provider === "local") {
    try {
      new URL(settings.localEndpoint);
    } catch {
      errors.push("Local endpoint must be a valid URL.");
    }
  }

  return {
    ok: errors.length === 0,
    settings,
    errors
  };
}

module.exports = {
  createSettingsStore,
  validateSettings
};
