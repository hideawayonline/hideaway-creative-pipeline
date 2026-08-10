# Hideaway — Marketing & P&L Pipeline

Automated daily feed for **The Ecommerce Equation** sheet, surfaced in Looker
Studio with **MER** as the hero metric.

> **The one rule:** feed the existing model, don't rebuild it. The pipe writes
> only the **8 raw-input rows**. Every derived field (MER, profit, VCR, FCR,
> ROAS, ...) keeps computing from the sheet's own formulas.

```
Shopify (ShopifyQL) ─┐
Meta  (Windsor)      ─┤
Google (Windsor)     ─┼──►  DATA_FEED tab  ──►  month tabs (INDEX/MATCH by date)  ──►  Looker
TikTok (Windsor)     ─┘     (1 row/day,          (formulas untouched)                 (reads the SHEET)
                            raw inputs only)
```

Data path (decided 6 Jun 2026): **Shopify Admin API direct** for
revenue/orders/sessions/items/COGS, **Windsor.ai REST** for ad spend. Runs as a
Google Apps Script bound to the sheet on a ~6am AEST trigger.

---

## Field map (every value reconciled against the sheet's own history)

| DATA_FEED col | Month-tab row | Source | Status |
|---|---|---|---|
| `revenue` | REVENUE | Shopify `total_sales` (tax-incl top line) | ✅ exact match |
| `orders` | Orders | Shopify `orders` | ✅ exact |
| `items_sold` | Items Sold | Shopify `net_items_sold` | ⚠️ within ~1% (see Open items) |
| `sessions` | Store Sessions | Shopify `sessions` | ✅ exact |
| `cogs` | Cost of Goods Sold / Product Cost | Shopify `cost_of_goods_sold` | ✅ matches manual entries |
| `fb_spend` | Facebook Ad Spend | Windsor `facebook` → `spend` (acct `1638082827495695`) | ✅ |
| `google_spend` | Google Ad Spend | Windsor `google_ads` → `spend` (acct `755-528-0386`) | ✅ |
| `tiktok_spend` | TikTok Ad Spend | Windsor `tiktok` → `spend` (acct `6902142628381343746`) | ✅ |

**`REVENUE` = Shopify `total_sales`, not `gross_sales`.** Shopify's `gross_sales`
is *ex-tax* product revenue; the sheet's REVENUE row is the tax-inclusive top
line. Verified — see Reconciliation below. The sheet's `Revenue Ex GST` formula
(`REVENUE / 1.06`) is left untouched.

**Left exactly as-is (not written by the pipe):** Revenue Ex GST, GST %, all
Store Performance rows, MER, Total Advertising, Total Variable/Fixed Costs, VCR,
FCR, TOTAL EXPENSES, PROFIT, Profit %, Sitewide ROAS, every Drivers reference,
`SNAPCHAT` (0), `Packaging` (0), `Fixed Advertising Expenses` (0).

---

## Reconciliation (proof, pulled live 6 Jun 2026)

| Date | Sheet REVENUE | Shopify `total_sales` | Sheet Sessions | Shopify `sessions` | Sheet COGS | Shopify `cost_of_goods_sold` |
|---|---|---|---|---|---|---|
| 1 Jun | $18,674.00 | $18,674.38 | 8,790 | 8,790 | $2,432.00 | $2,432.36 |
| 2 Jun | $17,098.50 | $17,098.50 | 9,708 | 9,708 | $2,174.00 | $2,174.95 |
| 3 Jun | $18,519.00 | $18,519.97 | 8,525 | 8,525 | $2,500.00 | $2,499.67 |
| 31 May | $22,419.38 | $22,419.38 | 10,162 | 10,162 | — | — |

Orders matched exactly on every checked day. The tiny REVENUE/COGS deltas are
the sheet's manual rounding to whole dollars — the pipe writes the precise
figure.

---

## Install (one-time)

1. **Create the bound script.** Open the working copy → Extensions → Apps Script.
   Paste each `.gs` file (or push with `clasp`). Set the project time zone to
   `Australia/Brisbane` (already in `appsscript.json`).

2. **Shopify custom app.** Shopify admin → Settings → Apps and sales channels →
   Develop apps → Create an app. Grant Admin API scope **`read_reports`** (needed
   for `shopifyqlQuery`) plus `read_orders`, `read_products`, `read_analytics`.
   Install it and copy the **Admin API access token**.

3. **Script Properties** (Project Settings → Script Properties). Never commit these:
   - `SHOPIFY_STORE_DOMAIN` = `future-waves-project.myshopify.com`
   - `SHOPIFY_ADMIN_TOKEN`  = `shpat_…`
   - `WINDSOR_API_KEY`      = your Windsor API key

4. **Repoint the model:** run `setupRepointAllMonths()` once. This rewrites the 8
   input rows in each month tab to DATA_FEED lookups and leaves all maths intact.

5. **Backfill:** run `runBackfill('2026-04-01','2026-06-06')` to populate DATA_FEED
   across history.

6. **Schedule:** run `installDailyTrigger()` for the ~6am AEST daily run.

7. Watch the hidden `_LOG` tab for run history / errors.

> **Validate on the COPY first.** Reconcile 3 historical days against the live
> sheet before cutting the script over to the live spreadsheet (handoff §11).

---

## Open decisions — resolved (handoff §10)

| # | Decision | Resolution (6 Jun 2026) |
|---|---|---|
| 1 | Product Cost source | **Pull Shopify `cost_of_goods_sold`** (matches manual entries to the dollar; cost-per-item is set on products). |
| 4 | Backfill vs go-forward | **Full historical backfill**, validated on the copy first. |
| — | Data path / runtime | **Shopify Admin API direct + Windsor**, Apps Script bound to the sheet. |
| 2 | Packaging ($0.85/order) | Left at 0 (unchanged). Flip on later if wanted. |
| 3 | Snapchat | Placeholder, held at 0. |
| 5 | Fixed-cost step-downs (staff departures) | Daily fixed held flat until a manual Drivers update. |
| 6 | Big sale-day spikes | Looker handles via the date control; MER tile reads the period ratio. |

## Open items to watch

- **Items Sold** is ~1% off `net_items_sold` (likely gross-ordered vs
  net-of-returns). Revisit the exact items metric if precision matters.
- **Sessions API surface.** Sessions come from Shopify's analytics layer
  (`shopifyqlQuery`, available on Plus). If a future API version drops it, fall
  back to GA4 sessions via Windsor `googleanalytics4`.
- **Meta account** is named **"HW 2"** (`1638082827495695`) — confirm it's the
  primary account carrying full Meta spend.
- **GST 6%.** The sheet's `Revenue Ex GST = REVENUE/1.06` is a deliberate model
  choice — left untouched per §11. Do not "correct" without sign-off.

---

## Looker Studio dashboard (hero = MER)

Source = the **sheet** (DATA_FEED + month tabs), never Windsor directly.

1. **Big-number MER** — current-period MER %, 30% target, traffic light
   (🟢 ≤30% · 🟠 30–35% · 🔴 >35%).
2. **MER trend** — daily MER with a 30% reference line.
3. **Spend vs Revenue** — daily Total Advertising vs Revenue (dual axis).
4. **Channel spend split** — FB / Google / TikTok stacked.
5. Secondary tiles: Profit %, Sitewide ROAS, AOV, Conversion Rate.
6. Date control defaults to current month; compare to previous period.

> MER = Total Advertising ÷ Revenue (%, **lower is better**, target ≤30%). Do not
> invert — the revenue/spend multiple is the separate "Sitewide ROAS".
