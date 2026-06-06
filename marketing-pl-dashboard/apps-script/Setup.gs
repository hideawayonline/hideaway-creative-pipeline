/**
 * ONE-CLICK SETUP. Run this once after pasting the code and adding the 3 secrets.
 * It repoints the input rows, loads all history, builds the Profit tab, and
 * schedules the daily 6am refresh. Safe to re-run.
 */
function firstTimeSetup() {
  setupRepointAllMonths();
  runBackfill('2026-04-01', fmtDate_(new Date()));
  installDailyTrigger();
  log_('OK', 'firstTimeSetup complete', '');
}
