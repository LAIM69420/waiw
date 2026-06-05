const fs = require("node:fs");
const path = require("node:path");
const { ERROR_CODES, toAppError } = require("./errors");
const { todayKey } = require("./scheduler");
const { wallpaperPath } = require("./wallpaperFiles");
const { generateImage } = require("./providers");

function normalizeExt(ext) {
  const clean = ext && ext.startsWith(".") ? ext : ".png";
  return [".png", ".jpg", ".jpeg", ".webp"].includes(clean.toLowerCase()) ? clean : ".png";
}

function createWallpaperService({ app, store, secretStore, logger }) {
  async function generateNow({ setWallpaper = true } = {}) {
    const settings = store.get("settings");
    const apiKey = settings.provider === "local" ? "" : await secretStore.get(settings.provider);

    logger.info("Generation started.", {
      provider: settings.provider,
      model: settings.model,
      resolution: settings.resolution,
      setWallpaper
    });

    try {
      const generated = await generateImage(settings, apiKey);
      const targetPath = wallpaperPath(app.getPath("userData"), new Date(), normalizeExt(generated.ext));
      fs.writeFileSync(targetPath, generated.buffer);

      const nextSettings = {
        ...settings,
        lastGeneratedDate: todayKey(),
        latestWallpaperPath: targetPath
      };
      store.set("settings", nextSettings);

      if (setWallpaper && settings.autoSetWallpaper) {
        await setLatestWallpaper(targetPath);
      }

      logger.info("Generation completed.", { targetPath: path.basename(targetPath) });
      return { ok: true, path: targetPath, settings: nextSettings };
    } catch (error) {
      const appError = toAppError(error);
      logger.error("Generation failed.", { code: appError.code, message: appError.message });
      return { ok: false, error: serializeError(appError) };
    }
  }

  async function setLatestWallpaper(explicitPath) {
    const settings = store.get("settings");
    const latest = explicitPath || settings.latestWallpaperPath;
    if (!latest || !fs.existsSync(latest)) {
      return {
        ok: false,
        error: { code: ERROR_CODES.WALLPAPER_FAILED, message: "No generated wallpaper exists yet." }
      };
    }

    try {
      const wallpaper = await import("wallpaper");
      await (wallpaper.setWallpaper || wallpaper.set)(latest);
      logger.info("Wallpaper set.", { path: path.basename(latest) });
      return { ok: true, path: latest };
    } catch (error) {
      const appError = toAppError(error, ERROR_CODES.WALLPAPER_FAILED);
      logger.error("Setting wallpaper failed.", { code: appError.code, message: appError.message });
      return { ok: false, error: serializeError(appError) };
    }
  }

  return {
    generateNow,
    setLatestWallpaper
  };
}

function serializeError(error) {
  return {
    code: error.code || ERROR_CODES.GENERATION_FAILED,
    message: error.message || "Unknown error."
  };
}

module.exports = {
  createWallpaperService
};
