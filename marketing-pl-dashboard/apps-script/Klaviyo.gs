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
