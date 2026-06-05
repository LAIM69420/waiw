const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wallpaperApp", {
  getBootstrap: () => ipcRenderer.invoke("settings:get-bootstrap"),
  saveSettings: (payload) => ipcRenderer.invoke("settings:save", payload),
  generateNow: () => ipcRenderer.invoke("wallpaper:generate-now"),
  setLatestWallpaper: () => ipcRenderer.invoke("wallpaper:set-latest"),
  openLogs: () => ipcRenderer.invoke("logs:open"),
  onStatus: (callback) => {
    ipcRenderer.on("status", (_event, payload) => callback(payload));
  }
});
