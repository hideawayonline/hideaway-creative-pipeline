/**
 * Hideaway — Marketing & P&L pipeline
 * Configuration only. Secrets live in Script Properties, never in this file.
 *
 * Architecture (see README.md):
 *   Shopify Admin (ShopifyQL) + Windsor.ai REST  ->  DATA_FEED tab
 *   ->  existing month tabs reference DATA_FEED by date  ->  Looker reads the sheet.
 *
 * The one rule: feed the existing model. The pipe writes ONLY the 8 raw-input
 * rows. Every derived / driver / formula row is left exactly as-is.
 */

var CONFIG = {
  // Month tabs to keep fed. Tab name -> {year, month}.
  MONTH_TABS: {
    'April 26': { year: 2026, month: 4 },
    'MAY 26':   { year: 2026, month: 5 },
    'JUN 26':   { year: 2026, month: 6 }
  },

  DATA_FEED_TAB: 'DATA_FEED',
  LOG_TAB: '_LOG',

  TIMEZONE: 'Australia/Brisbane', // AEST, no DST

  // Windsor ad connectors -> account id. The spend field per handoff §4.
  WINDSOR: {
    base: 'https://connectors.windsor.ai',
    connectors: {
      fb_spend:     { connector: 'facebook',   account: '1638082827495695' }, // "HW 2"
      google_spend: { connector: 'google_ads', account: '755-528-0386' },     // Hideaway ADS
      tiktok_spend: { connector: 'tiktok',     account: '6902142628381343746' } // hideAWAY Ads
    }
  },

  SHOPIFY: {
    apiVersion: '2025-01' // GraphQL Admin API version that exposes shopifyqlQuery
  },

  // DATA_FEED column layout (order matters; column A is the date key, stored as text).
  FEED_COLUMNS: ['date', 'revenue', 'orders', 'items_sold', 'sessions', 'cogs',
                 'fb_spend', 'google_spend', 'tiktok_spend', '_updated_at'],

  // Month-tab input row label (normalised) -> DATA_FEED field.
  // These 8 are the ONLY rows the pipe ever writes / repoints.
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
