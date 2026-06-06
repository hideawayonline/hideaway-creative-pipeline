# Looker Studio build pack — MER is the hero

Source = the **sheet** (the `DATA_FEED` tab), never Windsor. `DATA_FEED` is a
clean one-row-per-day table, which is exactly what Looker wants. Every metric
below is a definitional ratio of the raw inputs — no part of the proprietary
cost model is rebuilt here.

> MER = Total Ad Spend ÷ Revenue (%, **lower is better**, target ≤ 30%). Never
> invert it — revenue/spend is the separate "Sitewide ROAS".

---

## 1. Connect the data source

1. Looker Studio → **Create → Data source → Google Sheets**.
2. Pick the spreadsheet → worksheet **`DATA_FEED`** → **Use first row as headers**. Connect.
3. Fix field types:
   - `date` → **Date** (`YYYY-MM-DD`)
   - `revenue, cogs, fb_spend, google_spend, tiktok_spend` → **Number / Currency (AUD)**
   - `orders, items_sold, sessions` → **Number**
4. Set the default date range dimension to `date`.

## 2. Calculated fields (add on the data source)

| Field name | Type | Formula |
|---|---|---|
| `Total Ad Spend` | Number | `fb_spend + google_spend + tiktok_spend` |
| `MER` | Percent | `(SUM(fb_spend)+SUM(google_spend)+SUM(tiktok_spend)) / SUM(revenue)` |
| `Sitewide ROAS` | Number | `SUM(revenue) / (SUM(fb_spend)+SUM(google_spend)+SUM(tiktok_spend))` |
| `AOV` | Currency | `SUM(revenue) / SUM(orders)` |
| `Conversion Rate` | Percent | `SUM(orders) / SUM(sessions)` |

`MER`, `Sitewide ROAS`, `AOV`, `Conversion Rate` are **aggregated** fields (ratio
of period totals) — so they stay correct for any date range and split correctly
per day on a time series. They match the sheet's definitions exactly.

## 3. Components (handoff §9)

**a) Hero — MER scorecard**
- Chart: **Scorecard**, metric `MER`.
- **Conditional formatting** (Style → colour by value):
  🟢 `≤ 0.30` · 🟠 `0.30–0.35` · 🔴 `> 0.35`.
- Add a second scorecard or text box pinned with the **30% target**.

**b) MER trend line**
- Chart: **Time series**. Dimension `date`, metric `MER`.
- Add a **reference line** at `0.30` (constant) labelled "Target 30%".

**c) Spend vs Revenue (explains MER moves)**
- Chart: **Time series, two axes**. Dimension `date`.
- Left axis: `revenue`. Right axis: `Total Ad Spend`.

**d) Channel spend split**
- Chart: **Stacked column**. Dimension `date`, metrics `fb_spend`,
  `google_spend`, `tiktok_spend`.

**e) Secondary scorecards**
- `Sitewide ROAS`, `AOV`, `Conversion Rate`. (Profit % — see below.)

**f) Controls**
- **Date range control** defaulting to **This month**.
- Optional **comparison** = previous period (scorecards → "Comparison date range").

## 4. Profit % tile (needs the cost model)

Profit lives in the month tabs (drivers + fixed costs), so it isn't in
`DATA_FEED`. To surface it without rebuilding the maths, add a tiny **helper tab**
that pulls the model's already-computed daily Profit % into long form, then add
it to Looker as a blend on `date`.

Create a tab `DASH_PROFIT` with a header `date | profit_pct`, then for each month
paste a row that reads the month tab. Simplest: one `QUERY`/`INDEX` per day, or
ask me to add a `buildDashProfit()` function to the Apps Script that reads the
`PROFIT %` row from each month tab into this long format. (Flagged as a quick
phase-2 add so v1 can ship with the MER hero now.)

## 5. Publish

- Theme to taste; put the **MER hero top-left**, trend beside it, spend-vs-revenue
  and channel split below.
- Share read-only; the daily 6am pipe refreshes `DATA_FEED`, Looker re-reads on load.
