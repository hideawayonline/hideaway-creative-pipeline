#!/usr/bin/env python3
"""
Hideaway — Marketing & P&L pipeline (GitHub Actions / server-side runtime).

Backup for the in-sheet Apps Script: same architecture, same field mappings.
Pulls the 8 raw inputs from Shopify (ShopifyQL) + Windsor (ad spend) and upserts
them into the sheet's DATA_FEED tab via a Google service account. Writes ONLY
DATA_FEED; the month-tab INDEX/MATCH formulas and all derived maths are untouched.

Usage:
    python pipeline_pl.py                       # yesterday + today (idempotent)
    python pipeline_pl.py 2026-04-01 2026-06-06 # explicit backfill range

Env (GitHub Actions secrets):
    SHOPIFY_STORE_DOMAIN   e.g. future-waves-project.myshopify.com
    SHOPIFY_ADMIN_TOKEN    shpat_...
    WINDSOR_API_KEY        windsor api key
    SHEET_ID               target spreadsheet id
    GOOGLE_SERVICE_ACCOUNT_JSON   full service-account JSON (string)
"""
import os
import sys
import json
import datetime as dt
from zoneinfo import ZoneInfo

import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build

TZ = ZoneInfo("Australia/Brisbane")
SHOPIFY_API_VERSION = "2025-01"
DATA_FEED_TAB = "DATA_FEED"
FEED_COLUMNS = ["date", "revenue", "orders", "items_sold", "sessions", "cogs",
                "fb_spend", "google_spend", "tiktok_spend", "_updated_at"]

WINDSOR = {
    "fb_spend":     {"connector": "facebook",   "account": "1638082827495695"},
    "google_spend": {"connector": "google_ads", "account": "755-528-0386"},
    "tiktok_spend": {"connector": "tiktok",      "account": "6902142628381343746"},
}


def _num(v):
    if v in (None, ""):
        return 0
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return 0


# ----------------------------- Shopify -----------------------------------

def _shopifyql(query):
    domain = os.environ["SHOPIFY_STORE_DOMAIN"]
    token = os.environ["SHOPIFY_ADMIN_TOKEN"]
    url = f"https://{domain}/admin/api/{SHOPIFY_API_VERSION}/graphql.json"
    gql = ("query($q:String!){ shopifyqlQuery(query:$q){ __typename "
           "... on TableResponse { tableData { columns { name } rowData } } "
           "parseErrors { code message } } }")
    r = requests.post(url, headers={"X-Shopify-Access-Token": token},
                      json={"query": gql, "variables": {"q": query}}, timeout=60)
    r.raise_for_status()
    body = r.json()
    sq = (body.get("data") or {}).get("shopifyqlQuery")
    if not sq or not sq.get("tableData"):
        raise RuntimeError(f"ShopifyQL error for [{query}]: {sq and sq.get('parseErrors')}")
    cols = [c["name"] for c in sq["tableData"]["columns"]]
    return [dict(zip(cols, row)) for row in sq["tableData"]["rowData"]]


def fetch_shopify(date_from, date_to):
    out = {}
    sales = _shopifyql("FROM sales SHOW total_sales, orders, net_items_sold, "
                       f"cost_of_goods_sold TIMESERIES day SINCE {date_from} UNTIL {date_to}")
    for r in sales:
        d = str(r["day"])[:10]
        out.setdefault(d, {})
        out[d].update(revenue=_num(r.get("total_sales")), orders=_num(r.get("orders")),
                      items_sold=_num(r.get("net_items_sold")), cogs=_num(r.get("cost_of_goods_sold")))
    sessions = _shopifyql(f"FROM sessions SHOW sessions TIMESERIES day SINCE {date_from} UNTIL {date_to}")
    for r in sessions:
        d = str(r["day"])[:10]
        out.setdefault(d, {})["sessions"] = _num(r.get("sessions"))
    return out


# ----------------------------- Windsor -----------------------------------

def fetch_windsor(date_from, date_to):
    key = os.environ["WINDSOR_API_KEY"]
    out = {}
    for field, c in WINDSOR.items():
        r = requests.get(f"https://connectors.windsor.ai/{c['connector']}", params={
            "api_key": key, "date_from": date_from, "date_to": date_to,
            "fields": "date,spend", "account_id": c["account"],
        }, timeout=60)
        r.raise_for_status()
        for row in (r.json().get("data") or []):
            d = str(row["date"])[:10]
            out.setdefault(d, {})
            out[d][field] = out[d].get(field, 0) + _num(row.get("spend"))
    return out


# ----------------------------- Sheets ------------------------------------

def _sheets_service():
    info = json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"])
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets"])
    return build("sheets", "v4", credentials=creds)


def _ensure_tab(svc, sheet_id):
    meta = svc.spreadsheets().get(spreadsheetId=sheet_id).execute()
    tabs = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta["sheets"]}
    if DATA_FEED_TAB not in tabs:
        svc.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body={
            "requests": [{"addSheet": {"properties": {"title": DATA_FEED_TAB}}}]
        }).execute()
        svc.spreadsheets().values().update(
            spreadsheetId=sheet_id, range=f"{DATA_FEED_TAB}!A1",
            valueInputOption="RAW", body={"values": [FEED_COLUMNS]}).execute()


def upsert_data_feed(records):
    sheet_id = os.environ["SHEET_ID"]
    svc = _sheets_service()
    _ensure_tab(svc, sheet_id)

    existing = svc.spreadsheets().values().get(
        spreadsheetId=sheet_id, range=f"{DATA_FEED_TAB}!A2:A").execute().get("values", [])
    row_for_date = {r[0]: i + 2 for i, r in enumerate(existing) if r}
    next_row = len(existing) + 2
    now = dt.datetime.now(TZ).strftime("%Y-%m-%dT%H:%M:%S")

    data = []
    for d in sorted(records):
        rec = records[d]
        row = [d, rec.get("revenue", ""), rec.get("orders", ""), rec.get("items_sold", ""),
               rec.get("sessions", ""), rec.get("cogs", ""), rec.get("fb_spend", ""),
               rec.get("google_spend", ""), rec.get("tiktok_spend", ""), now]
        at = row_for_date.get(d, next_row)
        if d not in row_for_date:
            next_row += 1
        data.append({"range": f"{DATA_FEED_TAB}!A{at}:J{at}", "values": [row]})

    if data:
        svc.spreadsheets().values().batchUpdate(spreadsheetId=sheet_id, body={
            "valueInputOption": "USER_ENTERED", "data": data}).execute()
    return len(data)


# ------------------------------- main ------------------------------------

def main():
    if len(sys.argv) == 3:
        date_from, date_to = sys.argv[1], sys.argv[2]
    else:
        today = dt.datetime.now(TZ).date()
        date_from = (today - dt.timedelta(days=1)).isoformat()
        date_to = today.isoformat()

    shopify = fetch_shopify(date_from, date_to)
    ads = fetch_windsor(date_from, date_to)

    dates = sorted(set(shopify) | set(ads))
    records = {d: {**shopify.get(d, {}), **ads.get(d, {})} for d in dates
               if date_from <= d <= date_to}
    n = upsert_data_feed(records)
    print(f"OK {date_from}..{date_to}: {n} DATA_FEED rows written")


if __name__ == "__main__":
    main()
