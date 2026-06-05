const DEFAULT_SETTINGS = Object.freeze({
  provider: "openai",
  model: "gpt-image-1",
  prompt: "A calm cinematic landscape for a Windows desktop wallpaper, balanced composition, no text, no logos",
  style: "natural light, high detail, tasteful color grading",
  resolution: "1920x1080",
  scheduleTime: "08:00",
  autoSetWallpaper: true,
  runOnStartup: false,
  localEndpoint: "http://127.0.0.1:7860/generate",
  lastGeneratedDate: null,
  latestWallpaperPath: null
});

const PROVIDERS = Object.freeze({
  openai: {
    label: "OpenAI",
    requiresKey: true,
    defaultModel: "gpt-image-1",
    help: "Uses the OpenAI Images API."
  },
  stability: {
    label: "Stability AI",
    requiresKey: true,
    defaultModel: "stable-image-core",
    help: "Uses Stability AI image generation."
  },
  replicate: {
    label: "Replicate",
    requiresKey: true,
    defaultModel: "black-forest-labs/flux-schnell",
    help: "Uses Replicate predictions."
  },
  local: {
    label: "Local HTTP",
    requiresKey: false,
    defaultModel: "local",
    help: "Calls a local image generation endpoint."
  }
});

module.exports = {
  DEFAULT_SETTINGS,
  PROVIDERS
};
