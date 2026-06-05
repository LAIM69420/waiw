# waiw

A small Windows 10/11 Electron tray app that generates one fresh GenAI wallpaper per day, saves it locally, and sets it as the desktop background.

## Stack Choice

This repository did not contain an existing Windows desktop app. Electron is used because it is pragmatic for a Windows tray/background app, keeps the UI simple with plain HTML/CSS/JS, supports packaging, and can call native wallpaper/keychain helpers from Node.

## Features

- Windows system tray app with settings, generate-now, and set-latest actions.
- Selectable providers/models:
  - OpenAI Images API
  - Stability AI image generation
  - Replicate predictions
  - Local HTTP image endpoint
- Editable prompt, style, resolution, and daily schedule time.
- Date-based local wallpaper files.
- API keys stored via Windows Credential Manager when `keytar` is available.
- Encrypted local fallback for secrets if keychain storage is unavailable.
- Logs omit prompts and secrets by default.
- Handles missing keys, network failures, rate limits, and generation errors.

## Install

```bash
cd waiw
npm install
```

## Run During Development

```bash
npm start
```

On Windows, the app starts in the tray. Use the tray menu to open Settings.

## Build Windows Installer

```bash
npm run build
```

The NSIS installer is written to `dist/`.

## Provider Setup

Open Settings, choose a provider, enter a model and API key, then save. API keys are never hardcoded and are not written to logs.

For a local provider, set the endpoint URL. The endpoint should accept:

```json
{
  "prompt": "string",
  "style": "string",
  "resolution": "1920x1080",
  "model": "string"
}
```

It can return JSON with one of:

```json
{ "imageBase64": "..." }
{ "imageUrl": "https://..." }
{ "path": "C:\\path\\to\\image.png" }
```

or it can return raw image bytes.

## Local Data

Runtime data is stored under:

```text
%APPDATA%\DailyWallpaperGen
```

Generated wallpapers are stored in:

```text
%APPDATA%\DailyWallpaperGen\wallpapers
```

Logs are stored in:

```text
%APPDATA%\DailyWallpaperGen\logs\app.log
```

## Verify

```bash
npm test
```

The tests cover schedule decisions, date-based filenames, and secret redaction.
