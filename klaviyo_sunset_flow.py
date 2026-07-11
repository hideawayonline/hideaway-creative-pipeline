"""
Klaviyo sunset flow: identifies email subscribers who have gone quiet and
manages the two segments that drive re-engagement and eventual suppression.

Klaviyo's visual Flow canvas (the actual win-back email series with delays
and branches) can only be built in the Klaviyo UI -- it isn't something the
API can create. This script owns the data side instead:

  1. Syncs a "win-back" segment: subscribers who received email but haven't
     opened or clicked in KLAVIYO_WINBACK_DAYS (default 90). Use this
     segment as the entry trigger for a win-back Flow you build in Klaviyo.
  2. Syncs a "suppress" segment: subscribers who are still unresponsive
     after KLAVIYO_SUPPRESS_DAYS (default 180) -- i.e. the win-back flow
     didn't work. Doubling the win-back window gives that flow room to run
     before a profile is written off.
  3. With --execute, suppresses every profile in the "suppress" segment via
     Klaviyo's bulk suppression job, so they stop receiving marketing email
     entirely. This protects sender reputation/deliverability for the rest
     of the list. Without --execute, it's a dry run: segments are synced
     and counts are reported, but nobody is suppressed.

Your Klaviyo private API key needs: segments:read, segments:write,
profiles:read, profiles:write, subscriptions:read, subscriptions:write,
metrics:read.
"""

import argparse
import os
import sys
import time
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

KLAVIYO_API_KEY = os.getenv("KLAVIYO_API_KEY")
KLAVIYO_REVISION = os.getenv("KLAVIYO_REVISION", "2026-04-15")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

WINBACK_INACTIVITY_DAYS = int(os.getenv("KLAVIYO_WINBACK_DAYS", "90"))
SUPPRESS_INACTIVITY_DAYS = int(os.getenv("KLAVIYO_SUPPRESS_DAYS", "180"))

WINBACK_SEGMENT_NAME = "Sunset Flow - Win-Back Needed"
SUPPRESS_SEGMENT_NAME = "Sunset Flow - Ready to Suppress"

API_BASE = "https://a.klaviyo.com/api"
REQUIRED_METRICS = ["Opened Email", "Clicked Email", "Received Email"]


def _headers() -> dict:
    return {
        "Authorization": f"Klaviyo-API-Key {KLAVIYO_API_KEY}",
        "revision": KLAVIYO_REVISION,
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
    }


def _request(method: str, url_or_path: str, **kwargs) -> dict:
    url = url_or_path if url_or_path.startswith("http") else f"{API_BASE}{url_or_path}"
    max_attempts = 5
    for attempt in range(max_attempts):
        response = requests.request(method, url, headers=_headers(), timeout=30, **kwargs)
        if response.status_code == 429 and attempt < max_attempts - 1:
            retry_after = float(response.headers.get("Retry-After", 2 ** attempt))
            print(f"  Rate limited on {method} {url_or_path}, retrying in {retry_after:.0f}s...")
            time.sleep(retry_after)
            continue
        response.raise_for_status()
        return response.json() if response.content else {}


def get_metric_ids(names: list[str]) -> dict:
    print("  Resolving metric IDs (paginating /metrics)...")
    remaining = set(names)
    found = {}
    url = "/metrics"
    params = {"page[size]": 200}
    while url and remaining:
        resp = _request("GET", url, params=params)
        for metric in resp.get("data", []):
            metric_name = metric["attributes"]["name"]
            if metric_name in remaining:
                found[metric_name] = metric["id"]
                remaining.discard(metric_name)
        url = resp.get("links", {}).get("next")
        params = None
    missing = set(names) - found.keys()
    if missing:
        raise RuntimeError(
            f"Could not find Klaviyo metric(s): {', '.join(sorted(missing))}. "
            "This account may not have sent any campaigns yet."
        )
    return found


def metric_condition(metric_id: str, operator: str, value: int, days: int) -> dict:
    return {
        "type": "profile-metric",
        "metric_id": metric_id,
        "measurement": "count",
        "measurement_filter": {"type": "numeric", "operator": operator, "value": value},
        "timeframe_filter": {"type": "date", "operator": "in-the-last", "unit": "day", "quantity": days},
    }


def build_inactivity_segment_definition(metric_ids: dict, days: int) -> dict:
    return {
        "condition_groups": [
            {"conditions": [metric_condition(metric_ids["Opened Email"], "equals", 0, days)]},
            {"conditions": [metric_condition(metric_ids["Clicked Email"], "equals", 0, days)]},
            {"conditions": [metric_condition(metric_ids["Received Email"], "greater-than-or-equal", 1, days)]},
        ]
    }


def find_segment_by_name(name: str) -> Optional[str]:
    resp = _request("GET", "/segments", params={"filter": f"equals(name,'{name}')"})
    results = resp.get("data", [])
    return results[0]["id"] if results else None


def wait_for_segment_ready(segment_id: str, max_attempts: int = 10, interval_s: int = 5) -> None:
    for _ in range(max_attempts):
        resp = _request("GET", f"/segments/{segment_id}")
        if not resp["data"]["attributes"].get("is_processing"):
            return
        print(f"  Segment {segment_id} still processing, waiting {interval_s}s...")
        time.sleep(interval_s)
    print(
        f"  Warning: segment {segment_id} still processing after {max_attempts * interval_s}s; "
        "counts below may be incomplete."
    )


def ensure_segment(name: str, definition: dict) -> tuple[str, bool]:
    existing_id = find_segment_by_name(name)
    if existing_id:
        print(f"  Segment '{name}' already exists ({existing_id}).")
        return existing_id, False
    print(f"  Creating segment '{name}'...")
    body = {"data": {"type": "segment", "attributes": {"name": name, "definition": definition}}}
    resp = _request("POST", "/segments", json=body)
    segment_id = resp["data"]["id"]
    print(f"  Created segment '{name}' ({segment_id}).")
    wait_for_segment_ready(segment_id)
    return segment_id, True


def preview_segment_count(segment_id: str) -> str:
    resp = _request(
        "GET",
        f"/segments/{segment_id}/profiles",
        params={"page[size]": 100, "fields[profile]": "email"},
    )
    profiles = resp.get("data", [])
    has_more = bool(resp.get("links", {}).get("next"))
    return f"{len(profiles)}+" if has_more else str(len(profiles))


def suppress_segment(segment_id: str) -> dict:
    body = {
        "data": {
            "type": "profile-suppression-bulk-create-job",
            "attributes": {},
            "relationships": {"segment": {"data": {"type": "segment", "id": segment_id}}},
        }
    }
    resp = _request("POST", "/profile-suppression-bulk-create-jobs", json=body)
    job_id = resp["data"]["id"]
    print(f"  Suppression job {job_id} queued, polling for completion...")
    return poll_suppression_job(job_id)


def poll_suppression_job(job_id: str, max_attempts: int = 40, interval_s: int = 3) -> dict:
    attrs = {}
    for _ in range(max_attempts):
        resp = _request("GET", f"/profile-suppression-bulk-create-jobs/{job_id}")
        attrs = resp["data"]["attributes"]
        if attrs["status"] in ("complete", "cancelled"):
            return attrs
        time.sleep(interval_s)
    print(
        f"  Warning: suppression job {job_id} still '{attrs.get('status')}' "
        f"after {max_attempts * interval_s}s; check the Klaviyo dashboard."
    )
    return attrs


def send_slack_summary(
    winback_created: bool,
    winback_count: str,
    suppress_created: bool,
    suppress_count: str,
    execute: bool,
    job_summary: Optional[dict],
) -> None:
    if not SLACK_WEBHOOK_URL:
        print("  SLACK_WEBHOOK_URL not set, skipping Slack notification.")
        return
    lines = [
        ":email: *Klaviyo Sunset Flow Run*",
        f"*Win-back segment* ({'created' if winback_created else 'existing'}): "
        f"`{WINBACK_SEGMENT_NAME}` — {winback_count} profiles "
        f"(no opens/clicks in {WINBACK_INACTIVITY_DAYS}d)",
        f"*Suppress segment* ({'created' if suppress_created else 'existing'}): "
        f"`{SUPPRESS_SEGMENT_NAME}` — {suppress_count} profiles "
        f"(no opens/clicks in {SUPPRESS_INACTIVITY_DAYS}d)",
    ]
    if execute and job_summary:
        lines.append(
            f"*Suppression job:* {job_summary.get('status')} — "
            f"{job_summary.get('completed_count', 0)} suppressed, "
            f"{job_summary.get('skipped_count', 0)} skipped"
        )
    else:
        lines.append("*Suppression:* dry run, nobody suppressed. Re-run with `--execute` to suppress.")
    response = requests.post(SLACK_WEBHOOK_URL, json={"text": "\n".join(lines)}, timeout=10)
    response.raise_for_status()
    print("  Slack notification sent.")


def run_sunset_flow(execute: bool = False) -> dict:
    print("\n=== Klaviyo Sunset Flow ===")
    print(f"Win-back threshold : {WINBACK_INACTIVITY_DAYS}d of no opens/clicks")
    print(f"Suppress threshold : {SUPPRESS_INACTIVITY_DAYS}d of no opens/clicks")
    print(f"Mode               : {'EXECUTE (will suppress profiles)' if execute else 'DRY RUN'}\n")

    print("[1/4] Resolving engagement metric IDs...")
    metric_ids = get_metric_ids(REQUIRED_METRICS)

    print("[2/4] Syncing win-back segment...")
    winback_id, winback_created = ensure_segment(
        WINBACK_SEGMENT_NAME, build_inactivity_segment_definition(metric_ids, WINBACK_INACTIVITY_DAYS)
    )
    winback_count = preview_segment_count(winback_id)
    print(f"  Profiles currently matching: {winback_count}")

    print("[3/4] Syncing suppress-ready segment...")
    suppress_id, suppress_created = ensure_segment(
        SUPPRESS_SEGMENT_NAME, build_inactivity_segment_definition(metric_ids, SUPPRESS_INACTIVITY_DAYS)
    )
    suppress_count = preview_segment_count(suppress_id)
    print(f"  Profiles currently matching: {suppress_count}")

    job_summary = None
    if execute:
        print(f"[4/4] Suppressing ~{suppress_count} profile(s) in '{SUPPRESS_SEGMENT_NAME}'...")
        job_summary = suppress_segment(suppress_id)
        print(
            f"  Job status: {job_summary.get('status')} "
            f"(completed={job_summary.get('completed_count')}, skipped={job_summary.get('skipped_count')})"
        )
    else:
        print("[4/4] Dry run — skipping suppression. Pass --execute to actually suppress profiles.")

    send_slack_summary(winback_created, winback_count, suppress_created, suppress_count, execute, job_summary)

    print("\n=== Sunset flow complete ===")
    return {
        "winback_segment_id": winback_id,
        "suppress_segment_id": suppress_id,
        "executed": execute,
        "job": job_summary,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Sync Klaviyo win-back/suppress segments for the sunset flow, "
        "and optionally suppress profiles that never re-engaged."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Suppress every profile in the sunset segment. Without this flag, the "
        "script only syncs segments and reports counts (dry run).",
    )
    args = parser.parse_args()

    if not KLAVIYO_API_KEY:
        print("Error: KLAVIYO_API_KEY is not set in .env", file=sys.stderr)
        sys.exit(1)

    run_sunset_flow(execute=args.execute)


if __name__ == "__main__":
    main()
