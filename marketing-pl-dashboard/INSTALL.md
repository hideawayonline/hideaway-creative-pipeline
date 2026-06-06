# Install runbook — ~5 minutes, then it runs itself

Do this on the **working copy** first (live sheet stays untouched):
https://docs.google.com/spreadsheets/d/1fRI0aIcyNtRK9513mV87kemghGyFjy-ZqqW0G5Q5tIc/edit

---

## Step 1 — Get a Shopify token (2 min)

1. Shopify admin → **Settings → Apps and sales channels → Develop apps**.
2. **Create an app** → name it `PL Dashboard Pipe`.
3. **Configure Admin API scopes** → tick: `read_reports`, `read_orders`,
   `read_products`, `read_analytics`. Save.
4. **Install app** → reveal and copy the **Admin API access token** (`shpat_…`).

## Step 2 — Paste the script (1 min)

1. In the sheet: **Extensions → Apps Script**.
2. Delete the empty `Code.gs`, paste the contents of
   [`apps-script/Code.single.gs`](apps-script/Code.single.gs). Save (💾).
3. (Optional) **Project Settings → gear** → set time zone to
   `Australia/Brisbane` if not already.

## Step 3 — Add the 3 secrets (1 min)

**Project Settings → Script Properties → Add script property** (three times):

| Property | Value |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `future-waves-project.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN`  | the `shpat_…` token from Step 1 |
| `WINDSOR_API_KEY`      | your Windsor API key (Windsor → Account → API key) |

## Step 4 — Run it (1 min, approve the auth prompt once)

In the editor's function dropdown, pick and **Run** each, in order:

1. `setupRepointAllMonths` — repoints the 8 input rows to DATA_FEED. (First run
   pops a Google auth prompt — approve it.)
2. `runBackfill` — **edit the call first**: at the bottom of `runBackfill`'s use,
   run it from the editor after temporarily setting the dates, or just run
   `runDailyPipe` for today. To backfill all history, open the editor console and
   run: `runBackfill('2026-04-01','2026-06-06')`.
3. `installDailyTrigger` — schedules the ~6am AEST daily run.

> Tip: to run `runBackfill` with arguments, paste this tiny helper above it and
> run *that* once, then delete it:
> ```js
> function _backfillAll(){ runBackfill('2026-04-01','2026-06-06'); }
> ```

## Step 5 — Verify, then cut over

- Open the **DATA_FEED** tab (created automatically) — 67 rows, Apr 1 → today.
- Spot-check 3 days on a month tab against the originals; confirm MER/profit match.
- Check the hidden **_LOG** tab for `OK` rows.
- Happy? Repeat Steps 1–4 on the **live** sheet (same token/key).

---

### Notes
- **Meta spend Apr 1–2** isn't in Windsor (their data starts Apr 3); those two
  cells stay blank unless entered manually.
- If `runBackfill` errors on Shopify with a `shopifyqlQuery`/scope message, the
  `read_reports` scope (Step 1) isn't applied — re-check it. Sessions need it.
- Re-running any date is safe — it overwrites that date's DATA_FEED row, never
  duplicates.
