/**
 * Daily time-driven trigger management. Runs runDailyPipe ~6am AEST, before
 * Steven's morning check-in.
 */

function installDailyTrigger() {
  removeDailyTriggers();
  ScriptApp.newTrigger('runDailyPipe')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
  log_('OK', 'installed daily trigger for runDailyPipe @ ~6am ' + CONFIG.TIMEZONE, '');
}

function removeDailyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runDailyPipe') ScriptApp.deleteTrigger(t);
  });
}
