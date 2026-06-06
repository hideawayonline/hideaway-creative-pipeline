/** Shared helpers + run logging. */

function log_(status, message, ms) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.LOG_TAB);
    sh.getRange(1, 1, 1, 4).setValues([['timestamp_AEST', 'status', 'duration_ms', 'message']]);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  sh.appendRow([
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    status, ms === '' ? '' : ms, message
  ]);
}

/** Parse a Windsor/Shopify value to a number; strips currency/commas. */
function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function blankIfNull_(v) { return (v === null || v === undefined) ? '' : v; }

/** Normalise a 'day' value (Date or 'yyyy-MM-dd...' string) to 'yyyy-MM-dd'. */
function dayKey_(v) {
  if (v instanceof Date) return fmtDate_(v);
  return String(v).slice(0, 10);
}

function fmtDate_(d) { return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd'); }

function datesInRange_(from, to) {
  var out = [];
  var p = from.split('-'), q = to.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  var end = new Date(Number(q[0]), Number(q[1]) - 1, Number(q[2]), 12, 0, 0);
  while (d <= end) { out.push(fmtDate_(d)); d = new Date(d.getTime() + 86400000); }
  return out;
}

function normalizeLabel_(x) {
  return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Like normalizeLabel_ but keeps punctuation, so 'PROFIT' != 'Profit %'. */
function rawLabel_(x) {
  return String(x == null ? '' : x).toLowerCase().trim().replace(/\s+/g, ' ');
}

function findRowByLabel_(values, test) {
  for (var r = 0; r < values.length; r++) if (test(rawLabel_(values[r][0]))) return r;
  return -1;
}

function monthAbbr_(month) {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][month - 1];
}

function columnLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
