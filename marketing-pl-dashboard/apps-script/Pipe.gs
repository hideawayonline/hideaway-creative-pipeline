/**
 * Daily pipeline: pull raw inputs from Shopify (ShopifyQL) + Windsor (ad spend),
 * upsert them into DATA_FEED. Idempotent: a re-run for the same date overwrites
 * that date's row, never appends.
 */

/** Trigger entry point (~6am AEST). Refreshes yesterday (now closed) + today. */
function runDailyPipe() {
  var today = new Date();
  var yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  runPipeForRange_(fmtDate_(yesterday), fmtDate_(today));
}

/** Backfill helper. Run manually, e.g. runBackfill('2026-04-01','2026-06-06'). */
function runBackfill(dateFrom, dateTo) {
  runPipeForRange_(dateFrom, dateTo);
}

function runPipeForRange_(dateFrom, dateTo) {
  var t0 = Date.now();
  try {
    var shopify = fetchShopifyMetrics_(dateFrom, dateTo); // {date: {revenue,orders,items_sold,sessions,cogs}}
    var ads = fetchWindsorSpend_(dateFrom, dateTo);        // {date: {fb_spend,google_spend,tiktok_spend}}
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

/* ----------------------------- Shopify ----------------------------------- */

/**
 * Two ShopifyQL queries (validated to reconcile exactly against the sheet):
 *   FROM sales    -> total_sales (=REVENUE), orders, net_items_sold, cost_of_goods_sold
 *   FROM sessions -> sessions
 */
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

/** Run one ShopifyQL query via the GraphQL Admin API; return array of row objects. */
function shopifyql_(query) {
  var domain = getSecret_('SHOPIFY_STORE_DOMAIN'); // e.g. future-waves-project.myshopify.com
  var token = getSecret_('SHOPIFY_ADMIN_TOKEN');
  var url = 'https://' + domain + '/admin/api/' + CONFIG.SHOPIFY.apiVersion + '/graphql.json';
  var gql =
    'query($q:String!){ shopifyqlQuery(query:$q){ __typename ' +
    '  ... on TableResponse { tableData { columns { name } rowData } } ' +
    '  parseErrors { code message } } }';

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
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
    var o = {};
    cols.forEach(function (c, i) { o[c] = row[i]; });
    return o;
  });
}

/* ----------------------------- Windsor ----------------------------------- */

/** Pull daily spend per ad connector. Sums rows per date defensively. */
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

/* ----------------------------- DATA_FEED --------------------------------- */

function mergeByDate_(dateFrom, dateTo, shopify, ads) {
  var out = {};
  datesInRange_(dateFrom, dateTo).forEach(function (d) {
    out[d] = Object.assign({}, shopify[d] || {}, ads[d] || {});
  });
  return out;
}

/** Upsert records keyed by date string into DATA_FEED. Returns rows written. */
function upsertDataFeed_(records) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.DATA_FEED_TAB);
  if (!sh) sh = ss.insertSheet(CONFIG.DATA_FEED_TAB);

  var header = CONFIG.FEED_COLUMNS;
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@'); // keep date key as plain text
  }

  // index existing date keys -> row number
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
