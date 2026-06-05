function todayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function shouldGenerateToday(settings, now = new Date()) {
  return settings.lastGeneratedDate !== todayKey(now);
}

function parseScheduleTime(scheduleTime) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(scheduleTime || "");
  if (!match) {
    return { hour: 8, minute: 0 };
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function createDailyScheduler({ getSettings, onDue, logger }) {
  const schedule = require("node-schedule");
  let job = null;

  function stop() {
    if (job) {
      job.cancel();
      job = null;
    }
  }

  function start() {
    stop();
    const settings = getSettings();
    const { hour, minute } = parseScheduleTime(settings.scheduleTime);
    job = schedule.scheduleJob({ hour, minute, second: 0 }, async () => {
      const current = getSettings();
      if (!shouldGenerateToday(current)) {
        logger.info("Daily schedule skipped; wallpaper already generated today.");
        return;
      }
      await onDue();
    });
    logger.info("Daily schedule updated.", { hour, minute });
  }

  return {
    start,
    stop
  };
}

module.exports = {
  createDailyScheduler,
  parseScheduleTime,
  shouldGenerateToday,
  todayKey
};
