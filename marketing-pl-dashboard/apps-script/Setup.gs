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
 * and save it into the SHOPIFY_ADMIN_TOKEN script property automatically.
 * Needs script properties SHOPIFY_CLIENT_SECRET and SHOPIFY_OAUTH_CODE set first.
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
