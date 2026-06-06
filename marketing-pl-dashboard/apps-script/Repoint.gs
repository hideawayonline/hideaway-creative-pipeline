/**
 * One-time (idempotent) repoint of the 8 raw-input rows in each month tab to
 * INDEX/MATCH lookups against DATA_FEED, keyed on each column's date.
 *
 * GUARDRAILS:
 *  - Only the 8 input rows in INPUT_ROW_MAP are touched.
 *  - Every derived row (Revenue Ex GST, MER, VCR, FCR, profit, drivers, etc.)
 *    is left exactly as-is. We never overwrite a formula cell with a value.
 *  - Re-running is safe; it just rewrites the same lookup formulas.
 */

function setupRepointAllMonths() {
  Object.keys(CONFIG.MONTH_TABS).forEach(function (name) {
    var m = CONFIG.MONTH_TABS[name];
    repointMonthTab(name, m.year, m.month);
  });
}

/** Repoint a single month tab. e.g. repointMonthTab('JUN 26', 2026, 6). */
function repointMonthTab(sheetName, year, month) {
  var sh = resolveSheet_(sheetName);
  if (!sh) throw new Error('Tab not found: ' + sheetName);

  var values = sh.getDataRange().getValues();

  // {0-indexed column -> day number} for this month's day columns.
  var dayCols = findDayColumns_(values, year, month);
  var nCols = Object.keys(dayCols).length;
  if (nCols === 0) throw new Error('No day columns for ' + sheetName);

  // DATA_FEED field -> column letter
  var feedCol = {};
  CONFIG.FEED_COLUMNS.forEach(function (f, i) { feedCol[f] = columnLetter_(i + 1); });

  var rowsTouched = 0;
  for (var r = 0; r < values.length; r++) {
    var field = CONFIG.INPUT_ROW_MAP[normalizeLabel_(values[r][0])];
    if (!field) continue;
    Object.keys(dayCols).forEach(function (colStr) {
      var col = Number(colStr);
      var day = dayCols[col];
      var key = 'TEXT(DATE(' + year + ',' + month + ',' + day + '),"yyyy-mm-dd")';
      var col$ = '$' + feedCol[field];
      var formula =
        '=IFERROR(INDEX(' + CONFIG.DATA_FEED_TAB + '!' + col$ + ':' + col$ + ',' +
        'MATCH(' + key + ',' + CONFIG.DATA_FEED_TAB + '!$A:$A,0)),0)';
      sh.getRange(r + 1, col + 1).setFormula(formula);
    });
    rowsTouched++;
  }
  log_('OK', 'repointed ' + sheetName + ': ' + rowsTouched + ' input rows x ' + nCols + ' day columns', '');
  return rowsTouched;
}

/**
 * Day columns for a month tab, mapped by POSITION. The tabs aren't consistent
 * (June has "1 Jun" headers, April/May use weekday names), so we don't parse
 * headers — column A is the row label, day 1 is column B, day 2 is column C, and
 * so on up to the number of days in the month.
 * Returns { 0-indexed column -> day number }, e.g. {1:1, 2:2, ... 30:30}.
 */
function findDayColumns_(values, year, month) {
  var days = new Date(year, month, 0).getDate(); // 30, 31, ...
  var map = {};
  for (var d = 1; d <= days; d++) map[d] = d; // 0-indexed col d == day d (col A is 0)
  return map;
}
