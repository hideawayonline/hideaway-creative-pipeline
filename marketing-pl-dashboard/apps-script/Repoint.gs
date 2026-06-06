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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Tab not found: ' + sheetName);

  var values = sh.getDataRange().getValues();

  // {0-indexed column -> day number} for this month's day columns.
  var dayCols = findDayColumns_(values, month);
  var nCols = Object.keys(dayCols).length;
  if (nCols === 0) throw new Error('No "<day> ' + monthAbbr_(month) + '" header columns found in ' + sheetName);

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
 * Find the date-header row and its day columns. Scans every row, looking for
 * cells like "1 Jun" / "15 jun" that match the target month, and returns the
 * row with the most matches as {0-indexed col -> day number}.
 */
function findDayColumns_(values, month) {
  var abbr = monthAbbr_(month);
  var best = {}, bestCount = 0;
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var map = {}, c = 0;
    for (var col = 1; col < row.length; col++) {
      var cell = String(row[col] == null ? '' : row[col]).toLowerCase().trim();
      var m = cell.match(/^(\d{1,2})\s*([a-z]{3})/);
      if (m && m[2] === abbr) { map[col] = Number(m[1]); c++; }
    }
    if (c > bestCount) { bestCount = c; best = map; }
  }
  return best;
}
