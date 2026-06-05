const path = require("node:path");
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require("electron");
const { DEFAULT_SETTINGS, PROVIDERS } = require("./defaultSettings");
const { createLogger } = require("./logging");
const { createDailyScheduler, shouldGenerateToday } = require("./scheduler");
const { createSecretStore } = require("./secretStore");
const { createSettingsStore, validateSettings } = require("./settingsStore");
const { createWallpaperService } = require("./wallpaperService");

let mainWindow;
let tray;
let logger;
let store;
let secretStore;
let wallpaperService;
let scheduler;
let isGenerating = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  showSettingsWindow();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 720,
    minWidth: 720,
    minHeight: 620,
    show: false,
    title: "Daily Wallpaper Gen",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function showSettingsWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/svg+xml;utf8," +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <rect width="16" height="16" rx="3" fill="#1f2937"/>
        <circle cx="11.5" cy="4.5" r="2" fill="#f8fafc"/>
        <path d="M2 13h12L9.5 8 7 10.5 5.5 9z" fill="#22c55e"/>
      </svg>`)
  );
  tray = new Tray(icon);
  tray.setToolTip("Daily Wallpaper Gen");
  refreshTrayMenu();
  tray.on("double-click", showSettingsWindow);
}

function refreshTrayMenu() {
  const settings = store.get("settings");
  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Settings", click: showSettingsWindow },
    { type: "separator" },
    {
      label: "Generate Now",
      enabled: !isGenerating,
      click: () => runGeneration({ manual: true })
    },
    {
      label: "Set Latest Wallpaper",
      click: async () => broadcastStatus(await wallpaperService.setLatestWallpaper())
    },
    { type: "separator" },
    { label: `Provider: ${PROVIDERS[settings.provider]?.label || settings.provider}`, enabled: false },
    { label: `Schedule: ${settings.scheduleTime}`, enabled: false },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function broadcastStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status", payload);
  }
  return payload;
}

async function runGeneration({ manual = false } = {}) {
  if (isGenerating) {
    return broadcastStatus({ ok: false, error: { code: "busy", message: "Generation is already running." } });
  }

  isGenerating = true;
  refreshTrayMenu();
  broadcastStatus({ running: true, message: manual ? "Manual generation started." : "Scheduled generation started." });
  const result = await wallpaperService.generateNow({ setWallpaper: true });
  isGenerating = false;
  refreshTrayMenu();
  return broadcastStatus({ ...result, running: false });
}

function configureStartup(enabled) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath
  });
}

function registerIpc() {
  ipcMain.handle("settings:get-bootstrap", async () => {
    const settings = store.get("settings");
    return {
      settings,
      providers: PROVIDERS,
      hasApiKey: await secretStore.has(settings.provider),
      logFile: logger.logFile,
      userDataPath: app.getPath("userData")
    };
  });

  ipcMain.handle("settings:save", async (_event, payload) => {
    const validation = validateSettings(payload.settings || {});
    if (!validation.ok) {
      return { ok: false, errors: validation.errors };
    }

    const current = store.get("settings");
    const next = { ...current, ...validation.settings };
    store.set("settings", next);

    if (typeof payload.apiKey === "string" && payload.apiKey.trim()) {
      await secretStore.set(next.provider, payload.apiKey.trim());
    }

    configureStartup(next.runOnStartup);
    scheduler.start();
    refreshTrayMenu();
    logger.info("Settings saved.", {
      provider: next.provider,
      model: next.model,
      resolution: next.resolution,
      scheduleTime: next.scheduleTime
    });

    return { ok: true, settings: next, hasApiKey: await secretStore.has(next.provider) };
  });

  ipcMain.handle("wallpaper:generate-now", () => runGeneration({ manual: true }));
  ipcMain.handle("wallpaper:set-latest", async () => broadcastStatus(await wallpaperService.setLatestWallpaper()));
  ipcMain.handle("logs:open", async () => {
    await shell.openPath(logger.logFile);
    return { ok: true };
  });
}

app.whenReady().then(async () => {
  app.setName("Daily Wallpaper Gen");
  logger = createLogger(app);
  store = createSettingsStore(app);
  secretStore = createSecretStore(app, logger);
  wallpaperService = createWallpaperService({ app, store, secretStore, logger });
  scheduler = createDailyScheduler({
    getSettings: () => store.get("settings"),
    onDue: () => runGeneration({ manual: false }),
    logger
  });

  createWindow();
  createTray();
  registerIpc();
  configureStartup(store.get("settings").runOnStartup);
  scheduler.start();

  if (!store.get("settings").lastGeneratedDate) {
    showSettingsWindow();
  } else if (shouldGenerateToday(store.get("settings"))) {
    logger.info("App started before today's generation; waiting for scheduled time.");
  }
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  app.isQuiting = true;
  scheduler?.stop();
});
