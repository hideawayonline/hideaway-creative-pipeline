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

## 4. Profit % tile (from the model, via DASH_PROFIT)

Profit lives in the month tabs (drivers + fixed costs), so it isn't a `DATA_FEED`
ratio. The Apps Script `buildDashProfit()` function reshapes the model's
**already-computed** `PROFIT` and `Profit %` rows into a long-format **`DASH_PROFIT`**
tab (`date | profit | profit_pct`) — nothing is recomputed. It runs automatically
after each daily pipe, and you can run it manually once now.

To add the tiles:
1. **Add data source** → Google Sheets → worksheet **`DASH_PROFIT`** → set `date`
   to **Date**, `profit_pct` to **Percent**, `profit` to **Currency (AUD)**.
2. Either use it as a **second data source** for the Profit scorecards, or **blend**
   it with `DATA_FEED` on the `date` join key to mix Profit % into combined charts.
3. Scorecards: `profit_pct` (vs the ~9.35% target) and `profit`. For a daily
   profit trend, time series on `date` × `profit`.

## 5. Publish

- Theme to taste; put the **MER hero top-left**, trend beside it, spend-vs-revenue
  and channel split below.
- Share read-only; the daily 6am pipe refreshes `DATA_FEED`, Looker re-reads on load.
