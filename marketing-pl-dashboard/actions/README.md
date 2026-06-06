# GitHub Actions runtime (backup)

Server-side alternative to the in-sheet Apps Script. Same field mappings, writes
only `DATA_FEED`. Use this if the Apps Script auth is ever a hassle, or you'd
rather the pipe live in CI than in the sheet.

The repoint of the month-tab input rows is still a **one-time** step — do it once
with the Apps Script `setupRepointAllMonths()` (the formulas are permanent). This
runtime just keeps `DATA_FEED` fed.

## Setup

1. **Service account** (Google Cloud console):
   - Create a service account, create a JSON key, enable the **Google Sheets API**.
   - **Share the spreadsheet** with the service account's email (Editor).
2. **Repo secrets** (Settings → Secrets and variables → Actions):
   | Secret | Value |
   |---|---|
   | `SHOPIFY_STORE_DOMAIN` | `future-waves-project.myshopify.com` |
   | `SHOPIFY_ADMIN_TOKEN` | `shpat_…` (scope `read_reports` etc.) |
   | `WINDSOR_API_KEY` | your Windsor key |
   | `SHEET_ID` | the spreadsheet id |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | the full service-account JSON |
3. **Activate the workflow:** move `pl-pipeline.yml` to
   `.github/workflows/pl-pipeline.yml` on the **default branch** (scheduled
   workflows only fire from the default branch).

## Run

- **Daily:** automatic at 06:00 AEST (`cron: 0 20 * * *`).
- **Backfill / manual:** Actions tab → *P&L pipeline (daily)* → **Run workflow**,
  optionally with `date_from` / `date_to` (e.g. `2026-04-01` → `2026-06-06`).
- **Local test:** export the same env vars and `python pipeline_pl.py 2026-04-01 2026-06-06`.

> Idempotent: re-running a date overwrites that date's `DATA_FEED` row.
