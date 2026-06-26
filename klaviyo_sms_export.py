"""
Klaviyo -> Kudosity (TransmitSMS) high-intent SMS list exporter.

Pulls members of a Klaviyo segment (your "high intent" audience), keeps only
profiles that are LEGALLY messageable by SMS (SMS marketing consent ==
SUBSCRIBED) and have a valid mobile number, ranks them by purchase intent
(predicted CLV), caps the list to your budget, and writes a CSV you can upload
directly at https://kudosity.transmitsms.com/u/messaging/campaign

Why a segment (not a raw profile filter)?
  Klaviyo's UI lets you express "high intent" with the full power of event data
  (Viewed Product / Added to Cart / Started Checkout in last N days, Active on
  Site, Placed Order, Predicted CLV, etc). You build that segment once in the
  UI, and this script just exports the messageable members of it. See
  README_KLAVIYO_SMS.md for the recommended segment recipe.

Usage:
  export KLAVIYO_API_KEY=pk_xxx
  python klaviyo_sms_export.py --segment-id ABC123 --limit 10000 --out sms_list.csv

  # dry run (counts + cost estimate, no file written):
  python klaviyo_sms_export.py --segment-id ABC123 --limit 10000 --dry-run
"""
import argparse
import csv
import os
import sys
import time

import requests
from dotenv import load_dotenv

try:
    import phonenumbers  # robust E.164 normalisation
except ImportError:  # pragma: no cover
    phonenumbers = None

load_dotenv()

KLAVIYO_API_KEY = os.getenv("KLAVIYO_API_KEY")
KLAVIYO_REVISION = os.getenv("KLAVIYO_REVISION", "2024-10-15")
BASE_URL = "https://a.klaviyo.com/api"


def _headers() -> dict:
    if not KLAVIYO_API_KEY:
        sys.exit(
            "ERROR: KLAVIYO_API_KEY is not set. Add it to .env or your environment.\n"
            "Get a Private API Key in Klaviyo: Settings > API keys > Create Private "
            "API Key (read access to Profiles & Segments is enough)."
        )
    return {
        "Authorization": f"Klaviyo-API-Key {KLAVIYO_API_KEY}",
        "revision": KLAVIYO_REVISION,
        "accept": "application/json",
    }


def _get(url: str, params: dict | None = None) -> dict:
    """GET with basic rate-limit (429) backoff."""
    for attempt in range(6):
        resp = requests.get(url, headers=_headers(), params=params, timeout=60)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 2 ** attempt))
            print(f"  rate limited, sleeping {wait}s...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    resp.raise_for_status()
    return {}


def fetch_segment_profiles(segment_id: str) -> list[dict]:
    """Page through every profile in a segment, with subscription + predictive data."""
    url = f"{BASE_URL}/segments/{segment_id}/profiles/"
    params = {
        "additional-fields[profile]": "subscriptions,predictive_analytics",
        "page[size]": 100,
    }
    profiles: list[dict] = []
    page = 1
    while url:
        data = _get(url, params=params)
        batch = data.get("data", [])
        profiles.extend(batch)
        print(f"  page {page}: +{len(batch)} (total {len(profiles)})")
        # cursor pagination: 'next' is a full URL with the cursor embedded
        url = data.get("links", {}).get("next")
        params = None  # the 'next' link already carries all query params
        page += 1
    return profiles


def sms_marketing_consent(profile: dict) -> str | None:
    sub = (
        profile.get("attributes", {})
        .get("subscriptions", {})
        .get("sms", {})
        .get("marketing", {})
    )
    return sub.get("consent")


def predicted_clv(profile: dict) -> float:
    pa = profile.get("attributes", {}).get("predictive_analytics") or {}
    return pa.get("predicted_clv") or 0.0


def normalise_mobile(raw: str | None, region: str) -> str | None:
    """Return E.164 (+614...) for a valid mobile, else None."""
    if not raw:
        return None
    raw = raw.strip()
    if phonenumbers is not None:
        try:
            num = phonenumbers.parse(raw, region)
            if not phonenumbers.is_valid_number(num):
                return None
            ntype = phonenumbers.number_type(num)
            # exclude fixed lines; allow mobile + fixed-or-mobile
            if ntype not in (
                phonenumbers.PhoneNumberType.MOBILE,
                phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE,
            ):
                return None
            return phonenumbers.format_number(
                num, phonenumbers.PhoneNumberFormat.E164
            )
        except phonenumbers.NumberParseException:
            return None
    # Fallback: naive AU normalisation if phonenumbers isn't installed
    digits = "".join(c for c in raw if c.isdigit() or c == "+")
    if digits.startswith("+"):
        return digits
    if digits.startswith("0") and len(digits) == 10:  # 04xxxxxxxx
        return "+61" + digits[1:]
    if digits.startswith("61"):
        return "+" + digits
    return None


def build_list(profiles: list[dict], region: str) -> tuple[list[dict], dict]:
    """Filter to SMS-consented + valid mobile, dedupe, sort by intent (CLV desc)."""
    stats = {
        "fetched": len(profiles),
        "consented": 0,
        "valid_mobile": 0,
        "duplicates": 0,
    }
    seen: set[str] = set()
    rows: list[dict] = []
    for p in profiles:
        if sms_marketing_consent(p) != "SUBSCRIBED":
            continue
        stats["consented"] += 1
        attrs = p.get("attributes", {})
        mobile = normalise_mobile(attrs.get("phone_number"), region)
        if not mobile:
            continue
        stats["valid_mobile"] += 1
        if mobile in seen:
            stats["duplicates"] += 1
            continue
        seen.add(mobile)
        rows.append(
            {
                "mobile": mobile,
                "first_name": (attrs.get("first_name") or "").strip(),
                "last_name": (attrs.get("last_name") or "").strip(),
                "_clv": predicted_clv(p),
            }
        )
    # Highest predicted CLV first, so capping keeps the most valuable contacts.
    rows.sort(key=lambda r: r["_clv"], reverse=True)
    return rows, stats


def write_csv(rows: list[dict], out_path: str) -> None:
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["mobile", "first_name", "last_name"])
        for r in rows:
            writer.writerow([r["mobile"], r["first_name"], r["last_name"]])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--segment-id", required=True, help="Klaviyo segment ID to export")
    parser.add_argument("--limit", type=int, default=10000, help="Max contacts to export")
    parser.add_argument("--region", default="AU", help="Default phone region (default AU)")
    parser.add_argument("--out", default="sms_list.csv", help="Output CSV path")
    parser.add_argument("--budget", type=float, default=345.0, help="Total SMS budget ($)")
    parser.add_argument(
        "--cost-per-sms", type=float, default=0.0345, help="Cost per single-part SMS ($)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Don't write the CSV")
    args = parser.parse_args()

    print(f"Fetching segment {args.segment_id} from Klaviyo...")
    profiles = fetch_segment_profiles(args.segment_id)

    rows, stats = build_list(profiles, args.region)
    messageable = len(rows)

    # Budget cap: never export more than the budget allows.
    budget_cap = int(args.budget // args.cost_per_sms)
    cap = min(args.limit, budget_cap)
    exported = rows[:cap]

    print("\n=== Summary ===")
    print(f"  Profiles in segment      : {stats['fetched']}")
    print(f"  SMS marketing SUBSCRIBED : {stats['consented']}")
    print(f"  Valid mobile numbers     : {stats['valid_mobile']}")
    print(f"  Duplicates removed       : {stats['duplicates']}")
    print(f"  Unique messageable       : {messageable}")
    print(f"  Budget cap (@${args.cost_per_sms}/sms, ${args.budget}) : {budget_cap}")
    print(f"  Exporting (capped)       : {len(exported)}")
    print(f"  Est. send cost           : ${len(exported) * args.cost_per_sms:,.2f}")
    if messageable > cap:
        print(
            f"  NOTE: {messageable - cap} messageable contacts left out of this send "
            f"(highest predicted-CLV {len(exported)} kept)."
        )

    if args.dry_run:
        print("\n(dry run — no file written)")
        return

    write_csv(exported, args.out)
    print(f"\nWrote {len(exported)} contacts -> {args.out}")
    print("Upload at https://kudosity.transmitsms.com/u/messaging/campaign")


if __name__ == "__main__":
    main()
