class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

const ERROR_CODES = Object.freeze({
  MISSING_KEY: "missing_key",
  NO_INTERNET: "no_internet",
  RATE_LIMIT: "rate_limit",
  GENERATION_FAILED: "generation_failed",
  WALLPAPER_FAILED: "wallpaper_failed",
  SETTINGS_INVALID: "settings_invalid"
});

function isLikelyNetworkError(error) {
  const code = error && (error.code || error.cause?.code);
  return ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(code);
}

function toAppError(error, fallbackCode = ERROR_CODES.GENERATION_FAILED) {
  if (error instanceof AppError) {
    return error;
  }

  if (isLikelyNetworkError(error)) {
    return new AppError(ERROR_CODES.NO_INTERNET, "No internet connection or provider endpoint unavailable.");
  }

  const status = error?.status || error?.response?.status;
  if (status === 401 || status === 403) {
    return new AppError(ERROR_CODES.MISSING_KEY, "Provider API key is missing or invalid.");
  }

  if (status === 429) {
    return new AppError(ERROR_CODES.RATE_LIMIT, "Provider rate limit reached. Try again later.");
  }

  return new AppError(fallbackCode, error?.message || "Generation failed.");
}

module.exports = {
  AppError,
  ERROR_CODES,
  toAppError
};
