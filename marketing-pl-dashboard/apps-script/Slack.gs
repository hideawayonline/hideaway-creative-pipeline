/**
 * Morning routine: refresh ad spend from Windsor (free, no Shopify token needed)
 * and post a "good morning" P&L summary to Slack, led by MER.
 *
 * Needs script property SLACK_WEBHOOK_URL (a Slack Incoming Webhook).
 * Schedule with installMorningTrigger(); test by running runMorningUpdate().
 */

function runMorningUpdate() {
  try { runDailyAds_(); } catch (e) { log_('WARN', 'ad refresh failed: ' + e, ''); }
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
  var rev = 0, fb = 0, gg = 0, tt = 0, lastDate = '', lastRev = 0, lastSpend = 0;
  for (var i = 1; i < data.length; i++) {
    var d = dayKey_(data[i][0]);
    if (d.slice(0, 7) !== ym) continue;
    var r = num_(data[i][1]);
    var s = num_(data[i][6]) + num_(data[i][7]) + num_(data[i][8]);
    rev += r; fb += num_(data[i][6]); gg += num_(data[i][7]); tt += num_(data[i][8]);
    if (r > 0 && d > lastDate) { lastDate = d; lastRev = r; lastSpend = s; }
  }
  var spend = fb + gg + tt;
  var mer = rev > 0 ? spend / rev : 0;

  var profit = 0, dp = ss.getSheetByName('DASH_PROFIT');
  if (dp) {
    var dv = dp.getDataRange().getValues();
    for (var j = 1; j < dv.length; j++) if (dayKey_(dv[j][0]).slice(0, 7) === ym) profit += num_(dv[j][1]);
  }

  var light = mer <= 0.30 ? ':large_green_circle:' : (mer <= 0.35 ? ':large_orange_circle:' : ':red_circle:');
  var msg = {
    text:
      ':sunny: *Hideaway — Morning P&L*  (' + ym + ' month-to-date)\n' +
      light + '  *MER: ' + (mer * 100).toFixed(1) + '%*   (target ≤ 30%)\n' +
      '*Revenue:* ' + money_(rev) + '    *Ad Spend:* ' + money_(spend) + '\n' +
      '*Profit:* ' + money_(profit) + '  (' + (rev > 0 ? (profit / rev * 100).toFixed(1) : '0') + '%)\n' +
      'Channels — FB ' + money_(fb) + ' · Google ' + money_(gg) + ' · TikTok ' + money_(tt) + '\n' +
      'Latest day with revenue: ' + (lastDate || 'n/a') + ' — ' + money_(lastRev) + ' rev, ' + money_(lastSpend) + ' spend'
  };
  UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(msg) });
  log_('OK', 'Slack morning summary sent for ' + ym, '');
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
