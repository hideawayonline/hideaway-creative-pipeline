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

/** Post a P&L summary led by the previous day's results (latest day with revenue). */
function sendSlackSummary_() {
  var url = getSecret_('SLACK_WEBHOOK_URL');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var feed = ss.getSheetByName(CONFIG.DATA_FEED_TAB);
  if (!feed) throw new Error('DATA_FEED missing — run loadHistoricalData first');

  var ym = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
  var data = feed.getDataRange().getValues();

  // month-to-date totals + the latest COMPLETED day (before today) with revenue
  var todayKey = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var mRev = 0, mSpend = 0, last = null;
  for (var i = 1; i < data.length; i++) {
    var d = dayKey_(data[i][0]);
    var rev = num_(data[i][1]);
    var spend = num_(data[i][6]) + num_(data[i][7]) + num_(data[i][8]);
    if (d.slice(0, 7) === ym) { mRev += rev; mSpend += spend; }
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

  // that day's profit (+ month-to-date profit) from DASH_PROFIT
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
