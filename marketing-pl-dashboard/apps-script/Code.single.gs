/**
 * Hideaway — Marketing & P&L pipeline (SINGLE-FILE build).
 *
 * This is the modular Config/Pipe/Repoint/Triggers/Util files concatenated into
 * one, so you can paste it into the Apps Script editor in a single step. The
 * separate files in this folder are the canonical source; this file is the
 * copy-paste convenience build and is kept identical to them.
 *
 * Setup order after pasting (see INSTALL.md):
 *   1) Project Settings -> Script Properties: SHOPIFY_STORE_DOMAIN,
 *      SHOPIFY_ADMIN_TOKEN, WINDSOR_API_KEY
 *   2) Run setupRepointAllMonths()   (repoints the 8 input rows; maths untouched)
 *   3) Run runBackfill('2026-04-01','2026-06-06')   (loads history into DATA_FEED)
 *   4) Run installDailyTrigger()     (~6am AEST daily)
 *
 * The pipe writes ONLY the 8 raw-input rows. Every derived/driver/formula row is
 * left exactly as-is.
 */

/* ============================== CONFIG ================================== */

var CONFIG = {
  MONTH_TABS: {
    'April 26': { year: 2026, month: 4 },
    'MAY 26':   { year: 2026, month: 5 },
    'JUN 26':   { year: 2026, month: 6 }
  },
  DATA_FEED_TAB: 'DATA_FEED',
  LOG_TAB: '_LOG',
  TIMEZONE: 'Australia/Brisbane', // AEST, no DST
  WINDSOR: {
    base: 'https://connectors.windsor.ai',
    connectors: {
      fb_spend:     { connector: 'facebook',   account: '1638082827495695' }, // "HW 2"
      google_spend: { connector: 'google_ads', account: '755-528-0386' },     // Hideaway ADS
      tiktok_spend: { connector: 'tiktok',     account: '6902142628381343746' } // hideAWAY Ads
    }
  },
  SHOPIFY: { apiVersion: '2025-01' },
  FEED_COLUMNS: ['date', 'revenue', 'orders', 'items_sold', 'sessions', 'cogs',
                 'fb_spend', 'google_spend', 'tiktok_spend', '_updated_at'],
  INPUT_ROW_MAP: {
    'revenue': 'revenue',
    'orders': 'orders',
    'items sold': 'items_sold',
    'store sessions': 'sessions',
    'cost of goods sold': 'cogs',
    'product cost': 'cogs',
    'facebook ad spend': 'fb_spend',
    'google ad spend': 'google_spend',
    'tiktok ad spend': 'tiktok_spend'
  }
};

function getSecret_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Missing Script Property: ' + key + ' (set it in Project Settings > Script Properties)');
  return v;
}

/* =============================== PIPE =================================== */

function runDailyPipe() {
  var today = new Date();
  var yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  runPipeForRange_(fmtDate_(yesterday), fmtDate_(today));
}

function runBackfill(dateFrom, dateTo) {
  runPipeForRange_(dateFrom, dateTo);
}

function runPipeForRange_(dateFrom, dateTo) {
  var t0 = Date.now();
  try {
    var shopify = fetchShopifyMetrics_(dateFrom, dateTo);
    var ads = fetchWindsorSpend_(dateFrom, dateTo);
    var records = mergeByDate_(dateFrom, dateTo, shopify, ads);
    var n = upsertDataFeed_(records);
    log_('OK', 'range ' + dateFrom + '..' + dateTo + ': ' + n + ' DATA_FEED rows written', Date.now() - t0);
    return n;
  } catch (e) {
    log_('ERROR', String((e && e.stack) || e), Date.now() - t0);
    throw e;
  }
}

function fetchShopifyMetrics_(dateFrom, dateTo) {
  var sales = shopifyql_(
    'FROM sales SHOW total_sales, orders, net_items_sold, cost_of_goods_sold ' +
    'TIMESERIES day SINCE ' + dateFrom + ' UNTIL ' + dateTo);
  var sessions = shopifyql_(
    'FROM sessions SHOW sessions TIMESERIES day SINCE ' + dateFrom + ' UNTIL ' + dateTo);

  var out = {};
  sales.forEach(function (r) {
    var d = dayKey_(r.day);
    out[d] = out[d] || {};
    out[d].revenue = num_(r.total_sales);
    out[d].orders = num_(r.orders);
    out[d].items_sold = num_(r.net_items_sold);
    out[d].cogs = num_(r.cost_of_goods_sold);
  });
  sessions.forEach(function (r) {
    var d = dayKey_(r.day);
    out[d] = out[d] || {};
    out[d].sessions = num_(r.sessions);
  });
  return out;
}

function shopifyql_(query) {
  var domain = getSecret_('SHOPIFY_STORE_DOMAIN');
  var token = getSecret_('SHOPIFY_ADMIN_TOKEN');
  var url = 'https://' + domain + '/admin/api/' + CONFIG.SHOPIFY.apiVersion + '/graphql.json';
  var gql =
    'query($q:String!){ shopifyqlQuery(query:$q){ __typename ' +
    '  ... on TableResponse { tableData { columns { name } rowData } } ' +
    '  parseErrors { code message } } }';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Shopify-Access-Token': token },
    payload: JSON.stringify({ query: gql, variables: { q: query } })
  });
  var code = resp.getResponseCode();
  var body = JSON.parse(resp.getContentText() || '{}');
  if (code !== 200 || body.errors) {
    throw new Error('Shopify GraphQL HTTP ' + code + ': ' + resp.getContentText().slice(0, 300));
  }
  var sq = body.data && body.data.shopifyqlQuery;
  if (!sq || !sq.tableData) {
    var pe = sq && sq.parseErrors ? JSON.stringify(sq.parseErrors) : 'no tableData returned';
    throw new Error('ShopifyQL error for [' + query + ']: ' + pe);
  }
  var cols = sq.tableData.columns.map(function (c) { return c.name; });
  return sq.tableData.rowData.map(function (row) {
    var o = {}; cols.forEach(function (c, i) { o[c] = row[i]; }); return o;
  });
}

function fetchWindsorSpend_(dateFrom, dateTo) {
  var key = getSecret_('WINDSOR_API_KEY');
  var out = {};
  Object.keys(CONFIG.WINDSOR.connectors).forEach(function (field) {
    var c = CONFIG.WINDSOR.connectors[field];
    var url = CONFIG.WINDSOR.base + '/' + c.connector +
      '?api_key=' + encodeURIComponent(key) +
      '&date_from=' + dateFrom + '&date_to=' + dateTo +
      '&fields=date,spend' +
      '&account_id=' + encodeURIComponent(c.account);
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      throw new Error('Windsor ' + c.connector + ' HTTP ' + resp.getResponseCode() +
        ': ' + resp.getContentText().slice(0, 200));
    }
    var data = (JSON.parse(resp.getContentText() || '{}').data) || [];
    data.forEach(function (r) {
      var d = dayKey_(r.date);
      out[d] = out[d] || {};
      out[d][field] = (out[d][field] || 0) + num_(r.spend);
    });
  });
  return out;
}

function mergeByDate_(dateFrom, dateTo, shopify, ads) {
  var out = {};
  datesInRange_(dateFrom, dateTo).forEach(function (d) {
    out[d] = Object.assign({}, shopify[d] || {}, ads[d] || {});
  });
  return out;
}

function upsertDataFeed_(records) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.DATA_FEED_TAB);
  if (!sh) sh = ss.insertSheet(CONFIG.DATA_FEED_TAB);
  var header = CONFIG.FEED_COLUMNS;
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');
  }
  var last = sh.getLastRow();
  var idx = {};
  if (last > 1) {
    var keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) idx[String(keys[i][0])] = i + 2;
  }
  var nowAest = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  var count = 0;
  Object.keys(records).sort().forEach(function (d) {
    var rec = records[d];
    var row = [
      d,
      blankIfNull_(rec.revenue), blankIfNull_(rec.orders), blankIfNull_(rec.items_sold),
      blankIfNull_(rec.sessions), blankIfNull_(rec.cogs),
      blankIfNull_(rec.fb_spend), blankIfNull_(rec.google_spend), blankIfNull_(rec.tiktok_spend),
      nowAest
    ];
    var at = idx[d] || (sh.getLastRow() + 1);
    sh.getRange(at, 1, 1, row.length).setValues([row]);
    idx[d] = at;
    count++;
  });
  return count;
}

/* ============================= REPOINT ================================= */

function setupRepointAllMonths() {
  Object.keys(CONFIG.MONTH_TABS).forEach(function (name) {
    var m = CONFIG.MONTH_TABS[name];
    repointMonthTab(name, m.year, m.month);
  });
}

function repointMonthTab(sheetName, year, month) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Tab not found: ' + sheetName);
  var values = sh.getDataRange().getValues();
  var dayCols = findDayColumns_(values, month);
  var nCols = Object.keys(dayCols).length;
  if (nCols === 0) throw new Error('No "<day> ' + monthAbbr_(month) + '" header columns found in ' + sheetName);

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

/* ============================= TRIGGERS ================================ */

function installDailyTrigger() {
  removeDailyTriggers();
  ScriptApp.newTrigger('runDailyPipe')
    .timeBased().atHour(6).everyDays(1).inTimezone(CONFIG.TIMEZONE).create();
  log_('OK', 'installed daily trigger for runDailyPipe @ ~6am ' + CONFIG.TIMEZONE, '');
}

function removeDailyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runDailyPipe') ScriptApp.deleteTrigger(t);
  });
}

/* =============================== UTIL ================================== */

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

function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function blankIfNull_(v) { return (v === null || v === undefined) ? '' : v; }
function dayKey_(v) { return (v instanceof Date) ? fmtDate_(v) : String(v).slice(0, 10); }
function fmtDate_(d) { return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd'); }
function datesInRange_(from, to) {
  var out = [], p = from.split('-'), q = to.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  var end = new Date(Number(q[0]), Number(q[1]) - 1, Number(q[2]), 12, 0, 0);
  while (d <= end) { out.push(fmtDate_(d)); d = new Date(d.getTime() + 86400000); }
  return out;
}
function normalizeLabel_(x) {
  return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function monthAbbr_(month) {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][month - 1];
}
function columnLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
