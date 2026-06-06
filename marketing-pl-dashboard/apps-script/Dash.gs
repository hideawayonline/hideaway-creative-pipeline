/**
 * DASH_PROFIT — long-format reporting tab for Looker.
 *
 * Profit lives in the month tabs (cost model + drivers), so it can't be a pure
 * DATA_FEED ratio. This reads the model's ALREADY-COMPUTED `PROFIT` and
 * `Profit %` rows for each day and writes them one-row-per-day. Nothing is
 * recomputed — we just reshape what the sheet already calculated.
 *
 * Rebuilt from scratch on each run; refreshed automatically after runDailyPipe.
 */
function buildDashProfit() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DASH_PROFIT');
  if (!sh) sh = ss.insertSheet('DASH_PROFIT');
  sh.clearContents();

  var rows = [['date', 'profit', 'profit_pct']];
  Object.keys(CONFIG.MONTH_TABS).forEach(function (name) {
    var m = CONFIG.MONTH_TABS[name];
    var tab = ss.getSheetByName(name);
    if (!tab) return;
    var values = tab.getDataRange().getValues();
    var dayCols = findDayColumns_(values, m.year, m.month);
    var profitRow = findRowByLabel_(values, function (l) { return l === 'profit'; });
    var pctRow = findRowByLabel_(values, function (l) { return l === 'profit %'; });
    if (profitRow < 0 || pctRow < 0) return;

    Object.keys(dayCols).forEach(function (colStr) {
      var col = Number(colStr);
      var day = dayCols[col];
      var profit = num_(values[profitRow][col]);
      var pctRaw = values[pctRow][col];
      var pct = (typeof pctRaw === 'number') ? pctRaw : num_(pctRaw);
      if (profit === 0 && pct === 0) return; // skip empty / future days
      var d = Utilities.formatDate(new Date(m.year, m.month - 1, day, 12, 0, 0),
        CONFIG.TIMEZONE, 'yyyy-MM-dd');
      rows.push([d, profit, pct]);
    });
  });

  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange('A:A').setNumberFormat('@');
  if (rows.length > 1) sh.getRange(2, 3, rows.length - 1, 1).setNumberFormat('0.00%');
  log_('OK', 'built DASH_PROFIT: ' + (rows.length - 1) + ' day rows', '');
  return rows.length - 1;
}
