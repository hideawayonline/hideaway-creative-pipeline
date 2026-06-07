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
  SHOPIFY: { apiVersion: '2025-01', clientId: 'b9189138a4c8db61910bd8b662e5ff16' },
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

/**
 * ONE-CLICK SETUP. Run this once after pasting the code and adding the 3 secrets.
 * It repoints the input rows, loads all history, builds the Profit tab, and
 * schedules the daily 6am refresh. Safe to re-run.
 */
/**
 * Re-apply the lookup formulas to all month tabs and rebuild the profit tab.
 * Run this after loadHistoricalData if the month tabs show 0s.
 */
function repointAndRefresh() {
  setupRepointAllMonths();
  SpreadsheetApp.flush();
  buildDashProfit();
  log_('OK', 'repointAndRefresh complete', '');
}

function firstTimeSetup() {
  setupRepointAllMonths();
  runBackfill('2026-04-01', fmtDate_(new Date()));
  installDailyTrigger();
  log_('OK', 'firstTimeSetup complete', '');
}

/**
 * One-time: exchange a Shopify OAuth code for a permanent Admin API access token
 * and save it into SHOPIFY_ADMIN_TOKEN automatically.
 * Set script properties SHOPIFY_CLIENT_SECRET and SHOPIFY_OAUTH_CODE first.
 */
function getShopifyTokenFromCode() {
  var shop = getSecret_('SHOPIFY_STORE_DOMAIN');
  var secret = getSecret_('SHOPIFY_CLIENT_SECRET');
  var code = getSecret_('SHOPIFY_OAUTH_CODE');
  var resp = UrlFetchApp.fetch('https://' + shop + '/admin/oauth/access_token', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({ client_id: CONFIG.SHOPIFY.clientId, client_secret: secret, code: code })
  });
  var body = JSON.parse(resp.getContentText() || '{}');
  if (resp.getResponseCode() !== 200 || !body.access_token) {
    throw new Error('Token exchange failed HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 300));
  }
  PropertiesService.getScriptProperties().setProperty('SHOPIFY_ADMIN_TOKEN', body.access_token);
  log_('OK', 'Shopify Admin API token saved. Now run firstTimeSetup.', '');
  return 'Token saved — now run firstTimeSetup()';
}

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
    SpreadsheetApp.flush(); // let the month tabs recompute before reading profit
    try { buildDashProfit(); } catch (e) { log_('WARN', 'DASH_PROFIT refresh failed: ' + e, ''); }
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
  var sh = resolveSheet_(sheetName);
  if (!sh) throw new Error('Tab not found: ' + sheetName);
  var values = sh.getDataRange().getValues();
  var dayCols = findDayColumns_(values, year, month);
  var nCols = Object.keys(dayCols).length;
  if (nCols === 0) throw new Error('No day columns for ' + sheetName);

  var feedCol = {};
  CONFIG.FEED_COLUMNS.forEach(function (f, i) { feedCol[f] = columnLetter_(i + 1); });

  var rowsTouched = 0;
  for (var r = 0; r < values.length; r++) {
    var field = CONFIG.INPUT_ROW_MAP[normalizeLabel_(values[r][0])];
    if (!field) continue;
    Object.keys(dayCols).forEach(function (colStr) {
      var col = Number(colStr);
      var day = dayCols[col];
      var dateLit = 'DATE(' + year + ',' + month + ',' + day + ')';
      var col$ = '$' + feedCol[field];
      var idx = 'INDEX(' + CONFIG.DATA_FEED_TAB + '!' + col$ + ':' + col$ + ',';
      var A = CONFIG.DATA_FEED_TAB + '!$A:$A';
      var formula =
        '=IFERROR(' + idx + 'MATCH(' + dateLit + ',' + A + ',0)),' +
        'IFERROR(' + idx + 'MATCH(TEXT(' + dateLit + ',"yyyy-mm-dd"),' + A + ',0)),0))';
      sh.getRange(r + 1, col + 1).setFormula(formula);
    });
    rowsTouched++;
  }
  log_('OK', 'repointed ' + sheetName + ': ' + rowsTouched + ' input rows x ' + nCols + ' day columns', '');
  return rowsTouched;
}

function findDayColumns_(values, year, month) {
  var days = new Date(year, month, 0).getDate(); // 30, 31, ...
  var map = {};
  for (var d = 1; d <= days; d++) map[d] = d; // 0-indexed col d == day d (col A is 0)
  return map;
}

/* ============================ DASH_PROFIT ============================== */

function buildDashProfit() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DASH_PROFIT');
  if (!sh) sh = ss.insertSheet('DASH_PROFIT');
  sh.clearContents();

  var rows = [['date', 'profit', 'profit_pct']];
  Object.keys(CONFIG.MONTH_TABS).forEach(function (name) {
    var m = CONFIG.MONTH_TABS[name];
    var tab = resolveSheet_(name);
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
      if (profit === 0 && pct === 0) return;
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

/* =========================== DATA LOADER =============================== */

/**
 * One-time, NO-TOKEN data load. Bakes in the real Apr 1 - Jun 6 2026 numbers
 * (Shopify revenue/orders/items/sessions/COGS + Meta/Google/TikTok spend,
 * pulled and reconciled against the sheet's own history) and writes them into
 * DATA_FEED. Run this once to light up the whole model + dashboard without
 * needing a Shopify API token. Safe to re-run (idempotent upsert).
 *
 * Columns: date, revenue, orders, items_sold, sessions, cogs, fb_spend,
 *          google_spend, tiktok_spend  (Meta blank for Apr 1-2: not in Windsor)
 */
function loadHistoricalData() {
  var ROWS = [
    ['2026-04-01',28112.01,338,1789,8801,3553.03,'',1167.93,1665.5],
    ['2026-04-02',21060.58,253,1350,7436,2540.82,'',990.69,998.44],
    ['2026-04-03',20498.78,233,1317,9129,2587.63,69.64,1210.23,1457.72],
    ['2026-04-04',19793.62,244,1256,8756,2390.68,70.01,1102.52,1107.12],
    ['2026-04-05',21007.12,250,1316,11044,2457.27,317.64,1000.02,1423.96],
    ['2026-04-06',21408.22,249,1366,15356,2714.22,913.94,1015.16,1376.98],
    ['2026-04-07',24596.62,296,2096,19794,2699.66,1490.67,1118.89,1475.4],
    ['2026-04-08',20849.58,252,1365,13028,2415.96,1500.64,1192.44,1718.74],
    ['2026-04-09',24934.34,296,1710,19617,3050.83,1500.82,1088.33,1131.28],
    ['2026-04-10',21145.4,268,1436,10380,2808.06,2289.37,1257.5,1120.61],
    ['2026-04-11',19025.45,212,1102,8816,2287.91,3382.68,1170.88,1187.46],
    ['2026-04-12',15836.73,186,950,7456,1915.65,3646.67,858.97,761.65],
    ['2026-04-13',13526.81,164,820,9921,1667,3290.25,968.81,1117.61],
    ['2026-04-14',16920.82,201,1101,10407,1992.84,3007.83,1259.72,2007.4],
    ['2026-04-15',24790.33,286,1610,10704,2818.77,3896.14,1166.88,1650.97],
    ['2026-04-16',26782.79,314,1764,9195,3248.5,4621.21,1459.12,1646.17],
    ['2026-04-17',27326.9,316,1780,10665,3279.12,6225.5,1523.3,1185.22],
    ['2026-04-18',23701.13,257,1432,11758,2899.66,5220.84,1587.73,1296.95],
    ['2026-04-19',21952.41,240,1289,9515,2602.22,3944.8,1913.46,885.99],
    ['2026-04-20',15887.91,184,882,8096,1779.83,3054.26,822.8,1077.48],
    ['2026-04-21',21614.27,253,1183,12555,2561.75,4889.46,786.33,1495.7],
    ['2026-04-22',26277.06,302,1534,8872,3216.42,4652.15,752.35,723.21],
    ['2026-04-23',24592.24,271,1469,8716,3022.71,5417.37,701.72,816.37],
    ['2026-04-24',22242.25,263,1354,9231,2693.76,5290.08,658.28,906.36],
    ['2026-04-25',21279.11,240,1280,10489,2440.26,4490.77,729.44,961.62],
    ['2026-04-26',20932.45,231,1170,12825,2519.62,5967.15,768.48,804.35],
    ['2026-04-27',24384.77,285,1310,12810,2880.04,6504.81,701.29,1220.46],
    ['2026-04-28',18013.52,208,1004,9618,2131.73,4068.04,813.05,870.43],
    ['2026-04-29',26526.83,276,1509,11076,3284.69,4720.73,640.33,1305.94],
    ['2026-04-30',27980.07,287,1656,12030,3296.98,6144.81,837.63,1021.71],
    ['2026-05-01',21671.02,236,1263,11858,2697.43,7264.72,659.04,1105.59],
    ['2026-05-02',20449.94,217,1179,9662,2506.87,6799.78,793.57,569.64],
    ['2026-05-03',19426.18,214,1196,7591,2435.35,4471.74,743.61,370.6],
    ['2026-05-04',18148.99,190,1130,8230,2185.9,4781.19,814.15,789.15],
    ['2026-05-05',13773.53,158,952,7080,1830.87,3577.87,567.97,714.99],
    ['2026-05-06',23195.59,262,1680,9298,3002.75,3813.51,1054.76,670.37],
    ['2026-05-07',21850.28,229,1908,9194,2775.16,4069.85,1224.24,744.31],
    ['2026-05-08',18236.54,207,1372,7738,2342.07,4546.99,1186.61,835.73],
    ['2026-05-09',18915.73,193,1343,8491,2424.13,4697.95,1232.49,691.59],
    ['2026-05-10',16682.25,172,1216,8130,2112.89,3881.8,1443.96,708.86],
    ['2026-05-11',11147.1,121,828,8050,1375.86,3470.68,842.03,1305.83],
    ['2026-05-12',12826.35,134,908,7546,1621.56,3252.02,863.28,1131.18],
    ['2026-05-13',15677.85,180,1195,7549,2072.39,4033.3,818.69,612.63],
    ['2026-05-14',18138.39,191,1330,10093,2260.37,5088.81,948.88,1015.78],
    ['2026-05-15',16703.11,177,1189,19246,2085.82,5705.64,927.77,810.24],
    ['2026-05-16',15971.56,164,1209,25060,2019.4,5758.84,732.31,1025.61],
    ['2026-05-17',142795.31,1524,10050,29744,22175.52,7643.71,737.35,3099.51],
    ['2026-05-18',49647.43,575,3481,25882,6976.49,10340.3,731.26,1883.63],
    ['2026-05-19',34322.51,413,2341,19759,4670.89,8265.87,768.76,1846.3],
    ['2026-05-20',78113.03,975,6185,21951,11818,7764.73,615.14,1153.7],
    ['2026-05-21',59463.22,863,7533,20063,10990.89,7976.43,528.56,915.61],
    ['2026-05-22',37199.74,507,3612,16322,6219.2,6491.68,527.41,999.65],
    ['2026-05-23',23821.52,319,1909,12864,3607.88,6400.04,576.55,84.74],
    ['2026-05-24',30374.76,392,2282,15729,4412.47,7694.35,453.45,794.69],
    ['2026-05-25',18472.5,236,1433,11366,2767.21,5473.74,448.62,937.96],
    ['2026-05-26',16925,218,1325,13051,2398.12,6137.24,440.86,1257.23],
    ['2026-05-27',21912.87,306,1696,12233,3156.67,5353.23,741.67,863.58],
    ['2026-05-28',21330.05,286,1535,11764,2906.48,6213.97,680.49,745.64],
    ['2026-05-29',22169.19,298,1793,10285,3206.73,6566.39,574.93,1028.24],
    ['2026-05-30',28078.31,340,2155,11705,4081.85,6186.74,535.58,1009.07],
    ['2026-05-31',22419.38,271,1599,10162,3000.44,6529.9,588.97,991.44],
    ['2026-06-01',18674.38,204,1387,8790,2432.36,5921.93,510.58,392.39],
    ['2026-06-02',17098.5,211,1177,9708,2174.95,7294.85,865.23,370.77],
    ['2026-06-03',18519.97,223,1351,8525,2499.67,5983.02,1114.3,370.38],
    ['2026-06-04',13416.94,154,999,7827,1771.73,4095.15,1327.23,805.46],
    ['2026-06-05',15059.18,182,1271,6213,2146.62,4086.03,880.73,402.15],
    ['2026-06-06',25121.4,297,2321,8262,3761.06,6007.89,904.93,317.28],
    ['2026-06-07',21125.81,250,1920,8269,3073.32,6411.49,1148.9,310.79]
  ];
  var records = {};
  ROWS.forEach(function (r) {
    records[r[0]] = {
      revenue: r[1], orders: r[2], items_sold: r[3], sessions: r[4], cogs: r[5],
      fb_spend: r[6], google_spend: r[7], tiktok_spend: r[8]
    };
  });
  var n = upsertDataFeed_(records);
  SpreadsheetApp.flush();
  try { buildDashProfit(); } catch (e) { log_('WARN', 'DASH_PROFIT: ' + e, ''); }
  log_('OK', 'loadHistoricalData: wrote ' + n + ' rows into DATA_FEED', '');
  return n;
}


/* ============================= KLAVIYO ================================= */

/**
 * Klaviyo daily metrics — new email subscribers and unsubscribes (churn).
 * Free to automate: needs a Klaviyo Private API key (script property
 * KLAVIYO_API_KEY, starts with "pk_"). Writes into DATA_FEED columns
 * K (new_emails) and L (lost_emails), keyed by Brisbane day.
 */

var KLAVIYO = {
  revision: '2024-10-15',
  metrics: { new_emails: 'XGjLwT', lost_emails: 'XdpKxH' } // Subscribed / Unsubscribed from Email Marketing
};

/** Pull daily counts for both metrics between dateFrom (incl) and dateTo (excl). */
function fetchKlaviyo_(dateFrom, dateTo) {
  var key = getSecret_('KLAVIYO_API_KEY');
  var out = {};
  Object.keys(KLAVIYO.metrics).forEach(function (field) {
    var body = { data: { type: 'metric-aggregate', attributes: {
      metric_id: KLAVIYO.metrics[field],
      measurements: ['count'],
      interval: 'day',
      page_size: 500,
      timezone: CONFIG.TIMEZONE,
      filter: ['greater-or-equal(datetime,' + dateFrom + 'T00:00:00)',
               'less-than(datetime,' + dateTo + 'T00:00:00)']
    }}};
    var resp = UrlFetchApp.fetch('https://a.klaviyo.com/api/metric-aggregates/', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'Authorization': 'Klaviyo-API-Key ' + key, 'revision': KLAVIYO.revision, 'accept': 'application/json' },
      payload: JSON.stringify(body)
    });
    if (resp.getResponseCode() !== 200) {
      throw new Error('Klaviyo ' + field + ' HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 200));
    }
    var b = JSON.parse(resp.getContentText());
    var dates = (b.data && b.data.attributes && b.data.attributes.dates) || [];
    var series = b.data.attributes.data[0] && b.data.attributes.data[0].measurements.count || [];
    for (var i = 0; i < dates.length; i++) {
      var d = Utilities.formatDate(new Date(dates[i]), CONFIG.TIMEZONE, 'yyyy-MM-dd');
      out[d] = out[d] || {};
      out[d][field] = series[i] || 0;
    }
  });
  return out;
}

/** Write Klaviyo new_emails (col K) + lost_emails (col L) onto existing DATA_FEED rows. */
function upsertKlaviyo_(klav) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.DATA_FEED_TAB);
  if (!sh || sh.getLastRow() < 2) return;
  if (sh.getRange(1, 11).getValue() !== 'new_emails') sh.getRange(1, 11).setValue('new_emails');
  if (sh.getRange(1, 12).getValue() !== 'lost_emails') sh.getRange(1, 12).setValue('lost_emails');

  var keys = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var idx = {};
  for (var i = 0; i < keys.length; i++) idx[dayKey_(keys[i][0])] = i + 2;
  Object.keys(klav).forEach(function (d) {
    var row = idx[d];
    if (!row) return;
    var rec = klav[d];
    if (rec.new_emails != null) sh.getRange(row, 11).setValue(rec.new_emails);
    if (rec.lost_emails != null) sh.getRange(row, 12).setValue(rec.lost_emails);
  });
}

/** Daily Klaviyo refresh for the last ~75 days (covers the loaded range). */
function runDailyKlaviyo_() {
  var today = new Date();
  var from = new Date(today.getTime() - 75 * 24 * 3600 * 1000);
  var to = new Date(today.getTime() + 24 * 3600 * 1000); // exclusive end → includes today
  upsertKlaviyo_(fetchKlaviyo_(fmtDate_(from), fmtDate_(to)));
  log_('OK', 'Klaviyo email metrics refreshed', '');
}


/* ============================== SLACK ================================== */

/**
 * Morning routine: refresh ad spend from Windsor (free, no Shopify token needed)
 * and post a "good morning" P&L summary to Slack, led by MER.
 *
 * Needs script property SLACK_WEBHOOK_URL (a Slack Incoming Webhook).
 * Schedule with installMorningTrigger(); test by running runMorningUpdate().
 */

function runMorningUpdate() {
  try { runDailyAds_(); } catch (e) { log_('WARN', 'ad refresh failed: ' + e, ''); }
  try { runDailyKlaviyo_(); } catch (e) { log_('WARN', 'klaviyo refresh failed: ' + e, ''); }
  sendSlackSummary_();
}

/** Refresh Meta/Google/TikTok spend from Windsor for the last 7 days (existing DATA_FEED rows only). */
function runDailyAds_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.DATA_FEED_TAB);
  if (!sh || sh.getLastRow() < 2) return;
  var today = new Date();
  var from = new Date(today.getTime() - 7 * 24 * 3600 * 1000);
  var ads = fetchWindsorSpend_(fmtDate_(from), fmtDate_(today));

  var keys = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var idx = {};
  for (var i = 0; i < keys.length; i++) idx[dayKey_(keys[i][0])] = i + 2;
  var nowAest = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");

  Object.keys(ads).forEach(function (d) {
    var row = idx[d];
    if (!row) return; // only refresh dates we already track
    var rec = ads[d];
    if (rec.fb_spend != null) sh.getRange(row, 7).setValue(rec.fb_spend);
    if (rec.google_spend != null) sh.getRange(row, 8).setValue(rec.google_spend);
    if (rec.tiktok_spend != null) sh.getRange(row, 9).setValue(rec.tiktok_spend);
    sh.getRange(row, 10).setValue(nowAest);
  });
  SpreadsheetApp.flush();
  try { buildDashProfit(); } catch (e) {}
  log_('OK', 'daily ad spend refreshed', '');
}

/** Build a month-to-date P&L summary from DATA_FEED + DASH_PROFIT and post to Slack. */
function sendSlackSummary_() {
  var url = getSecret_('SLACK_WEBHOOK_URL');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var feed = ss.getSheetByName(CONFIG.DATA_FEED_TAB);
  if (!feed) throw new Error('DATA_FEED missing — run loadHistoricalData first');

  var ym = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
  var data = feed.getDataRange().getValues();

  var todayKey = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var mRev = 0, mSpend = 0, last = null;
  for (var i = 1; i < data.length; i++) {
    var d = dayKey_(data[i][0]);
    var rev = num_(data[i][1]);
    var spend2 = num_(data[i][6]) + num_(data[i][7]) + num_(data[i][8]);
    if (d.slice(0, 7) === ym) { mRev += rev; mSpend += spend2; }
    if (rev > 0 && d < todayKey && (!last || d > last.date)) {
      last = { date: d, rev: rev, orders: num_(data[i][2]), sessions: num_(data[i][4]),
               fb: num_(data[i][6]), gg: num_(data[i][7]), tt: num_(data[i][8]),
               newEmails: num_(data[i][10]), lostEmails: num_(data[i][11]) };
    }
  }
  if (!last) last = { date: 'n/a', rev: 0, orders: 0, sessions: 0, fb: 0, gg: 0, tt: 0 };

  var spend = last.fb + last.gg + last.tt;
  var mer = last.rev > 0 ? spend / last.rev : 0;
  var aov = last.orders > 0 ? last.rev / last.orders : 0;
  var conv = last.sessions > 0 ? last.orders / last.sessions : 0;

  var profit = 0, profitPct = 0, mProfit = 0, dp = ss.getSheetByName('DASH_PROFIT');
  if (dp) {
    var dv = dp.getDataRange().getValues();
    for (var j = 1; j < dv.length; j++) {
      var dk = dayKey_(dv[j][0]);
      if (dk === last.date) { profit = num_(dv[j][1]); profitPct = num_(dv[j][2]); }
      if (dk.slice(0, 7) === ym) mProfit += num_(dv[j][1]);
    }
  }

  var mtdMer = mRev > 0 ? mSpend / mRev : 0;
  var light = mer <= 0.30 ? ':large_green_circle:' : (mer <= 0.35 ? ':large_orange_circle:' : ':red_circle:');
  var label = last.date;
  try { label = Utilities.formatDate(new Date(last.date + 'T12:00:00'), CONFIG.TIMEZONE, 'EEE d MMM'); } catch (e) {}

  var msg = {
    text:
      ':sunny: *Hideaway — Daily P&L*  —  ' + label + '\n' +
      light + '  *MER: ' + (mer * 100).toFixed(1) + '%*   (target ≤ 30%)\n' +
      '*Revenue:* ' + money_(last.rev) + '     *Ad Spend:* ' + money_(spend) + '\n' +
      '*Profit:* ' + money_(profit) + '  (' + (profitPct * 100).toFixed(1) + '%)\n' +
      '*Orders:* ' + last.orders + '   *AOV:* ' + money_(aov) + '   *Sessions:* ' + last.sessions + '   *Conv:* ' + (conv * 100).toFixed(2) + '%\n' +
      'Channels — FB ' + money_(last.fb) + ' · Google ' + money_(last.gg) + ' · TikTok ' + money_(last.tt) + '\n' +
      ':email: *Emails:* +' + (last.newEmails || 0) + ' new  ·  −' + (last.lostEmails || 0) + ' churn  ·  net ' + ((last.newEmails || 0) - (last.lostEmails || 0)) + '\n' +
      '_Month to date:_  MER ' + (mtdMer * 100).toFixed(1) + '%  ·  Rev ' + money_(mRev) + '  ·  Spend ' + money_(mSpend) +
      '  ·  Profit ' + money_(mProfit) + ' (' + (mRev > 0 ? (mProfit / mRev * 100).toFixed(1) : '0') + '%)'
  };
  UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(msg) });
  log_('OK', 'Slack daily summary sent (' + last.date + ')', '');
}

function installMorningTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runMorningUpdate') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runMorningUpdate').timeBased().atHour(6).everyDays(1).inTimezone(CONFIG.TIMEZONE).create();
  log_('OK', 'installed morning trigger (runMorningUpdate ~6am ' + CONFIG.TIMEZONE + ')', '');
}

function money_(x) {
  var n = Math.round(Number(x) || 0);
  var s = String(Math.abs(n)), out = '';
  while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
  return (n < 0 ? '-$' : '$') + s + out;
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
function resolveSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var direct = ss.getSheetByName(name);
  if (direct) return direct;
  var target = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getName().toLowerCase().replace(/\s+/g, ' ').trim() === target) return all[i];
  }
  return null;
}
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
