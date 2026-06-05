const fs = require("node:fs");
const path = require("node:path");

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(api[_-]?key["'\s:=]+)[^"',\s]+/gi,
  /(authorization["'\s:=]+)[^"',\s]+/gi
];

function redact(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return SECRET_PATTERNS.reduce(
    (current, pattern) =>
      current.replace(pattern, (...args) => {
        const prefix = args.length > 3 && typeof args[1] === "string" ? args[1] : "";
        return `${prefix}[REDACTED]`;
      }),
    text
  );
}

function createLogger(app) {
  const logDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, "app.log");

  function write(level, message, meta = {}) {
    const entry = {
      at: new Date().toISOString(),
      level,
      message,
      meta
    };
    fs.appendFileSync(logFile, `${redact(entry)}\n`, "utf8");
  }

  return {
    logFile,
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta)
  };
}

module.exports = {
  createLogger,
  redact
};
