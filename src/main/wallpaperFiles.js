const fs = require("node:fs");
const path = require("node:path");

function datedWallpaperName(date = new Date(), ext = ".png") {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
  return `${day}-wallpaper${ext}`;
}

function wallpaperPath(userDataPath, date = new Date(), ext = ".png") {
  const dir = path.join(userDataPath, "wallpapers");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, datedWallpaperName(date, ext));
}

module.exports = {
  datedWallpaperName,
  wallpaperPath
};
