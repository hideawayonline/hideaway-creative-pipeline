# Meta Ad Account Clone — Export & Rebuild Plan

Model-agnostic runbook for cloning a Facebook/Meta ad account (structure + creative +
copy) from a **source** account into a **target** account that lives in a **different
Business Manager**.

Designed so the heavy execution can run on **Sonnet 5** (or any model) without loss of
fidelity — all the judgement calls are captured here, the runtime is mechanical.

---

## 0. Why two phases

My Meta connection follows the **user token** it's authed with, not a single ad account.

- **If one login is admin on both BMs** → add the target account under the same login and
  do a **direct rebuild** (skip export/save/restore). Faster, cleaner.
- **If the accounts are separate logins** → run the full **two-phase** flow below:
  export everything to durable storage now, then rebuild once target access exists.

**Critical:** this runs in an ephemeral cloud container. A local download folder is wiped
when the session ends. Everything worth keeping is persisted to **Google Drive** (media +
manifest) and the **repo** (manifest JSON) so the rebuild phase can be a different session,
days later.

---

## 1. Storage layout

```
Google Drive/
└── Hideaway Creatives/
    └── Account Clones/
        └── <SOURCE_ACCT_ID>_<YYYYMMDD>/
            ├── manifest.json            # full structure + copy + asset map
            ├── inventory.md             # human-readable summary
            ├── images/
            │   └── <image_hash>.<ext>
            └── videos/
                └── <video_id>.mp4

repo/
└── exports/
    └── <SOURCE_ACCT_ID>_<YYYYMMDD>/
        ├── manifest.json                # same manifest, version-controlled
        └── inventory.md
```

Media stays in Drive only (too heavy for git). The manifest lives in **both** so the
rebuild never depends on a single source surviving.

---

## 2. Phase 1 — Export (run on SOURCE)

Crawl top-down. Paginate every list call; never assume a single page. Save progress
incrementally so a rate-limit stall can resume, not restart.

### Crawl order & tools

| Step | What | Tool |
|---|---|---|
| 1 | Confirm source account | `ads_get_ad_accounts` |
| 2 | Campaigns | `ads_get_ad_entities` (level=campaign) |
| 3 | Ad sets (per campaign) | `ads_get_ad_entities` (level=adset) |
| 4 | Ads (per ad set) | `ads_get_ad_entities` (level=ad) |
| 5 | Creatives (per ad) | `ads_get_creatives` / `ads_get_creative_ads` |
| 6 | Image assets | `ads_get_ad_images` |
| 7 | Video assets | `ads_get_ad_videos` |
| 8 | Custom conversions | `ads_get_customconversions` |
| 9 | Custom audiences (reference only) | `ads_get_ad_account_custom_audiences` |
| 10 | Pages / IG connected | `ads_get_ad_account_pages`, `ads_get_ig_accounts` |

### Fields to capture per level

- **Campaign:** `id`, `name`, `objective`, `buying_type`, `special_ad_categories`,
  `daily_budget`/`lifetime_budget` (if CBO), `bid_strategy`, `status`
- **Ad set:** `id`, `name`, `optimization_goal`, `billing_event`, `bid_amount`,
  `daily_budget`/`lifetime_budget`, `start_time`/`end_time`, `targeting` (full object),
  `promoted_object` (pixel/custom-conversion/page), `attribution_spec`, `status`
- **Ad:** `id`, `name`, `creative` (id ref), `status`, `tracking_specs`
- **Creative:** `id`, `name`, `object_story_spec` (page_id, link_data / video_data:
  message, headline, description, link, call_to_action, image_hash / video_id),
  `asset_feed_spec` (for dynamic/flexible), `url_tags` (UTMs), `degrees_of_freedom_spec`
- **Image:** `hash`, `permalink_url`/`url`, downloaded filename
- **Video:** `id`, `source`, `title`, downloaded filename

### Media download

- Images: fetch `permalink_url`/`url` → save `images/<hash>.<ext>`.
- Videos: fetch `source` → save `videos/<id>.mp4`. If `source` is missing or compressed,
  flag it in the manifest (`"source_quality": "meta_compressed"`) and note the original
  master should come from Drive if available.
- Record a `sha256` per file so re-uploads can be de-duplicated.

---

## 3. Manifest schema (`manifest.json`)

```json
{
  "export": {
    "source_account_id": "act_XXXXXXXX",
    "exported_at": "2026-07-18T00:00:00Z",
    "counts": { "campaigns": 0, "adsets": 0, "ads": 0, "images": 0, "videos": 0 }
  },
  "assets": {
    "images": [
      { "hash": "abc123", "file": "images/abc123.jpg", "sha256": "…",
        "source_url": "https://…" }
    ],
    "videos": [
      { "id": "789", "file": "videos/789.mp4", "sha256": "…",
        "source_quality": "meta_compressed|original", "title": "…" }
    ]
  },
  "campaigns": [
    {
      "source_id": "1111",
      "name": "…", "objective": "OUTCOME_SALES", "buying_type": "AUCTION",
      "special_ad_categories": [], "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
      "daily_budget": null, "lifetime_budget": null, "status": "ACTIVE",
      "adsets": [
        {
          "source_id": "2222",
          "name": "…", "optimization_goal": "OFFSITE_CONVERSIONS",
          "billing_event": "IMPRESSIONS", "bid_amount": null,
          "daily_budget": "5000", "lifetime_budget": null,
          "start_time": null, "end_time": null,
          "targeting": { "...full targeting object..." },
          "promoted_object": { "pixel_id": "…", "custom_event_type": "PURCHASE" },
          "attribution_spec": [ { "event_type": "CLICK_THROUGH", "window_days": 7 } ],
          "status": "ACTIVE",
          "ads": [
            {
              "source_id": "3333", "name": "…", "status": "ACTIVE",
              "url_tags": "utm_source=…",
              "creative": {
                "page_id": "…", "instagram_actor_id": "…",
                "format": "link_data|video_data|asset_feed",
                "message": "primary text…", "headline": "…", "description": "…",
                "link": "https://…", "call_to_action": "SHOP_NOW",
                "image_hash": "abc123", "video_id": "789",
                "asset_feed_spec": null
              }
            }
          ]
        }
      ]
    }
  ],
  "reference": {
    "custom_conversions": [ { "id": "…", "name": "…", "rule": "…", "pixel_id": "…" } ],
    "custom_audiences": [ { "id": "…", "name": "…", "type": "…", "note": "share or rebuild" } ],
    "pages": [ { "id": "…", "name": "…" } ],
    "instagram_accounts": [ { "id": "…", "username": "…" } ]
  }
}
```

`source_id` on every node is kept purely for traceability; the target rebuild generates
brand-new IDs and maps them in a separate `rebuild_map.json`.

---

## 4. Phase 2 — Rebuild (run on TARGET)

Preconditions confirmed before any create call:
- Target ad account ID known and accessible on the connected token
- Target **Page** and **Instagram** account IDs (new BM's own — copy uses these, not source)
- Target **pixel/dataset** ID (shared from old BM to keep history, or new one)
- Payment method live on the target account

### Rebuild order (reverse of export)

1. **Upload media** into target → capture new `image_hash` / `video_id`, write to
   `rebuild_map.json` (`old_hash → new_hash`, `old_video_id → new_video_id`).
2. **Custom conversions** (if new pixel) → recreate, map old→new IDs.
3. **Campaigns** → `ads_create_campaign`. Build **PAUSED**. Map old→new.
4. **Ad sets** → `ads_create_ad_set`, remapping `promoted_object.pixel_id`,
   `custom_event`, and any audience refs to target equivalents. Build **PAUSED**.
5. **Creatives** → `ads_create_creative`, swapping in new `page_id`, `image_hash`,
   `video_id`, and target UTMs.
6. **Ads** → `ads_create_ad` linking new creative to new ad set. Build **PAUSED**.

**Everything is created PAUSED.** Nothing spends until Steve reviews and flips it on.

---

## 5. What does NOT transfer (flag, don't silently drop)

| Asset | Handling |
|---|---|
| Pixel / dataset history | Share old→new BM (keeps history) or new pixel (starts empty). |
| Custom / Lookalike audiences | Can't be duplicated. Share BM→BM, or rebuild off new pixel. |
| Social proof (likes/comments/shares) | Only kept by reusing the **same post ID**. Fresh uploads reset it. |
| Learning phase / historical stats | Never carries over — new ad sets learn fresh. |
| Billing / payment | Set up fresh on target BM. |

Reusing existing posts to preserve social proof is **opt-in** and only possible if the
target BM has permission on the source Page — decide per campaign at rebuild time.

---

## 6. Operational notes

- **Rate limits**, not model horsepower, are the bottleneck. Back off and resume on
  `#17`/`#80004` (rate) or `#4` (throttle) errors. Save manifest incrementally.
- Run the crawl in the background; report an inventory (counts) before downloading media.
- De-dupe media by `sha256` — the same image_hash often repeats across many ads.
- Keep the manifest the single source of truth; the rebuild reads it, never the live
  source account (which may be gone by then).

---

## 7. Go / no-go before starting

1. Admin on both BMs (→ direct rebuild) or separate logins (→ two-phase)?
2. Scope: whole account, or active/winning campaigns only? Include paused?
3. Reuse existing posts to keep social proof, or fresh creative?
4. Target pixel: share the existing one, or stand up a new one?
