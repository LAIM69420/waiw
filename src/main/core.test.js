const test = require("node:test");
const assert = require("node:assert/strict");
const { todayKey, shouldGenerateToday, parseScheduleTime } = require("./scheduler");
const { datedWallpaperName } = require("./wallpaperFiles");
const { redact } = require("./logging");
const { aspectRatio, combinedPrompt } = require("./providers");
const { validateSettings } = require("./settingsStore");

test("todayKey creates a stable local date key", () => {
  assert.equal(todayKey(new Date(2026, 5, 5, 7, 30)), "2026-06-05");
});

test("shouldGenerateToday skips after a successful daily generation", () => {
  const now = new Date(2026, 5, 5, 12, 0);
  assert.equal(shouldGenerateToday({ lastGeneratedDate: "2026-06-04" }, now), true);
  assert.equal(shouldGenerateToday({ lastGeneratedDate: "2026-06-05" }, now), false);
});

test("parseScheduleTime accepts valid HH:MM and falls back safely", () => {
  assert.deepEqual(parseScheduleTime("23:45"), { hour: 23, minute: 45 });
  assert.deepEqual(parseScheduleTime("bad"), { hour: 8, minute: 0 });
});

test("datedWallpaperName uses date-based filenames", () => {
  assert.equal(datedWallpaperName(new Date(2026, 5, 5), ".png"), "2026-06-05-wallpaper.png");
});

test("redact removes common secret forms", () => {
  const log = redact({
    authorization: "Bearer abc.def.ghi",
    api_key: "sk-testsecret"
  });
  assert.doesNotMatch(log, /abc\.def\.ghi/);
  assert.doesNotMatch(log, /sk-testsecret/);
  assert.doesNotMatch(log, /\$1/);
  assert.match(log, /\[REDACTED\]/);
});

test("provider helpers format prompt and aspect ratio", () => {
  assert.equal(aspectRatio("3840x2160"), "16:9");
  assert.equal(combinedPrompt({ prompt: "Mountains", style: "oil paint" }), "Mountains\n\nStyle: oil paint");
});

test("settings validation catches invalid schedule and resolution", () => {
  const result = validateSettings({
    provider: "openai",
    model: "gpt-image-1",
    prompt: "Wallpaper",
    resolution: "big",
    scheduleTime: "25:00"
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 2);
});
