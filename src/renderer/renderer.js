const form = document.querySelector("#settingsForm");
const statusEl = document.querySelector("#status");
const providerEl = document.querySelector("#provider");
const modelEl = document.querySelector("#model");
const promptEl = document.querySelector("#prompt");
const styleEl = document.querySelector("#style");
const resolutionEl = document.querySelector("#resolution");
const scheduleTimeEl = document.querySelector("#scheduleTime");
const autoSetWallpaperEl = document.querySelector("#autoSetWallpaper");
const runOnStartupEl = document.querySelector("#runOnStartup");
const apiKeyEl = document.querySelector("#apiKey");
const apiKeyWrap = document.querySelector("#apiKeyWrap");
const localEndpointEl = document.querySelector("#localEndpoint");
const localEndpointWrap = document.querySelector("#localEndpointWrap");
const providerHelpEl = document.querySelector("#providerHelp");
const keyStatusEl = document.querySelector("#keyStatus");
const latestWallpaperPathEl = document.querySelector("#latestWallpaperPath");
const logFileEl = document.querySelector("#logFile");
const dataPathEl = document.querySelector("#dataPath");
const generateNowBtn = document.querySelector("#generateNow");
const setLatestBtn = document.querySelector("#setLatest");
const openLogsBtn = document.querySelector("#openLogs");

let providers = {};
let currentSettings = {};
let hasApiKey = false;

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

function fillForm(settings) {
  currentSettings = settings;
  providerEl.value = settings.provider;
  modelEl.value = settings.model;
  promptEl.value = settings.prompt;
  styleEl.value = settings.style;
  resolutionEl.value = settings.resolution;
  scheduleTimeEl.value = settings.scheduleTime;
  autoSetWallpaperEl.checked = Boolean(settings.autoSetWallpaper);
  runOnStartupEl.checked = Boolean(settings.runOnStartup);
  localEndpointEl.value = settings.localEndpoint;
  latestWallpaperPathEl.textContent = settings.latestWallpaperPath || "None yet";
  updateProviderUi();
}

function updateProviderUi() {
  const provider = providers[providerEl.value];
  providerHelpEl.textContent = provider?.help || "";
  apiKeyWrap.hidden = !provider?.requiresKey;
  localEndpointWrap.hidden = providerEl.value !== "local";
  keyStatusEl.textContent = provider?.requiresKey
    ? hasApiKey
      ? "An API key is stored. Enter a new key only if you want to replace it."
      : "No API key is stored for this provider."
    : "No API key is needed for the local provider.";

  if (!modelEl.value && provider?.defaultModel) {
    modelEl.value = provider.defaultModel;
  }
}

function readSettingsFromForm() {
  return {
    ...currentSettings,
    provider: providerEl.value,
    model: modelEl.value.trim(),
    prompt: promptEl.value.trim(),
    style: styleEl.value.trim(),
    resolution: resolutionEl.value,
    scheduleTime: scheduleTimeEl.value,
    autoSetWallpaper: autoSetWallpaperEl.checked,
    runOnStartup: runOnStartupEl.checked,
    localEndpoint: localEndpointEl.value.trim()
  };
}

async function load() {
  const bootstrap = await window.wallpaperApp.getBootstrap();
  providers = bootstrap.providers;
  hasApiKey = bootstrap.hasApiKey;
  providerEl.innerHTML = Object.entries(providers)
    .map(([value, provider]) => `<option value="${value}">${provider.label}</option>`)
    .join("");
  logFileEl.textContent = bootstrap.logFile;
  dataPathEl.textContent = bootstrap.userDataPath;
  fillForm(bootstrap.settings);
  setStatus("Settings loaded.", "ok");
}

providerEl.addEventListener("change", () => {
  const provider = providers[providerEl.value];
  if (provider?.defaultModel) {
    modelEl.value = provider.defaultModel;
  }
  hasApiKey = false;
  apiKeyEl.value = "";
  updateProviderUi();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Saving settings...");
  const result = await window.wallpaperApp.saveSettings({
    settings: readSettingsFromForm(),
    apiKey: apiKeyEl.value
  });

  if (!result.ok) {
    setStatus(result.errors.join(" "), "error");
    return;
  }

  hasApiKey = result.hasApiKey;
  apiKeyEl.value = "";
  fillForm(result.settings);
  setStatus("Settings saved.", "ok");
});

generateNowBtn.addEventListener("click", async () => {
  generateNowBtn.disabled = true;
  setStatus("Generating wallpaper...");
  const result = await window.wallpaperApp.generateNow();
  generateNowBtn.disabled = false;
  handleActionResult(result, "Wallpaper generated.");
});

setLatestBtn.addEventListener("click", async () => {
  const result = await window.wallpaperApp.setLatestWallpaper();
  handleActionResult(result, "Latest wallpaper set.");
});

openLogsBtn.addEventListener("click", () => {
  window.wallpaperApp.openLogs();
});

window.wallpaperApp.onStatus((payload) => {
  if (payload.running) {
    setStatus(payload.message || "Working...");
    return;
  }
  handleActionResult(payload, "Done.");
});

function handleActionResult(result, successMessage) {
  if (!result) return;
  if (!result.ok) {
    setStatus(result.error?.message || "Action failed.", "error");
    return;
  }
  if (result.settings) {
    fillForm(result.settings);
  }
  if (result.path) {
    latestWallpaperPathEl.textContent = result.path;
  }
  setStatus(successMessage, "ok");
}

load().catch((error) => {
  setStatus(error.message || "Failed to load settings.", "error");
});
