# HW2 Ad Account Export — Inventory

**Source account:** HW2 — `act_1638082827495695`, Business Manager "Plat 1"
**Exported:** 2026-07-19
**Scope:** Active-only export, agreed with Steve — narrowed from the full account (66 campaigns,
thousands of ad sets/ads including a large "TESTING" sandbox) down to what's currently live.

Files in this export:
- `manifest.json` — full structure + creative data, follows the schema in
  `docs/ad-account-clone-plan.md` §3.
- `inventory.md` — this file.

---

## 1. Counts

| Level | Count |
|---|---|
| Campaigns | 8 |
| Ad sets | 39 |
| Ads | 198 |
| Distinct creatives referenced | 194 |
| Distinct image hashes | 12 |
| Distinct video IDs | 29 |

### Per-campaign breakdown

| Campaign | Ad sets | Ads | Daily budget | Bid strategy |
|---|---|---|---|---|
| Fathers Day (`120247058791650605`) | 18 | 102 | A$360.00 AUD | Cost per result goal |
| BODY PRODUCTS TESTING (`120246364783500605`) | 4 | 17 | — (ABO, ad-set-level budgets) | Highest volume |
| Clearance \| AU Cold \| Static Batch \| Jun'26 - Copy (`120246043405250605`) | 1 | 5 | A$300.00 AUD | Highest volume |
| 5 4 100_High Val_ SCALE perfume (`120245311559950605`) | 2 | 11 | A$1,200.00 AUD | Highest volume |
| TESTING (`120243318997670605`) | 10 | 51 | — (ABO, ad-set-level budgets) | — (not reported at campaign level) |
| Gifting (`120241816373150605`) | 1 | 6 | A$600.00 AUD | Bid cap |
| AU Retargeting (`120240111049580605`) | 2 | 4 | A$1,200.00 AUD | Highest volume |
| AUD DPA Open (`120239385165010605`) | 1 | 2 | A$1,200.00 AUD | Highest volume |
| **Total** | **39** | **198** | | |

All 8 campaigns, 39 ad sets, and 198 ads matched the pre-agreed active scope exactly —
no ad's creative fetch failed outright (0 of 198). See gaps below for what *within* each
creative could and couldn't be captured.

---

## 2. GAP — Ad set targeting is NOT available via this API path

**This is the most important gap in this export. Flagging explicitly per the task brief,
not silently omitted.**

The `ads_get_ad_entities` tool (Facebook Ads MCP) is reporting-oriented and rejects
adset-level `targeting`, `promoted_object`, `attribution_spec`, `billing_event`, and
`bid_amount` fields outright — it errors with:

> `Unsupported field(s) at level 'adset': targeting, promoted_object, attribution_spec, billing_event, bid_amount`

This was confirmed before this task began and re-confirmed during this export — no
workaround was found within the available toolset. As a result, **every ad set in
`manifest.json` has `targeting: null`** with a `targeting_status` field explaining the gap,
and `promoted_object`, `billing_event`, `bid_amount`, `attribution_spec` are all `null` too.

What **is** captured per ad set: `optimization_goal`, `bid_strategy`, `daily_budget`/
`lifetime_budget`, `start_time`/`end_time`, `attribution_setting`, `status`.

**Action needed before rebuild:** someone with Ads Manager UI access to HW2 needs to
manually document each of the 39 ad sets' targeting (custom/lookalike audiences, age/
gender/geo, placements, exclusions) and promoted_object (pixel + conversion event) —
screenshot or written notes — since the API cannot supply it here. This is unavoidable
manual work, not a scripting gap.

---

## 3. GAP — Creative copy/link data is largely inaccessible for boosted-post ads

A second, less anticipated gap surfaced during this export. Of the 194 distinct creatives:

| `object_type` | Count | What's recoverable |
|---|---|---|
| `SHARE` (existing/boosted Page or IG post) | 158 (81%) | **No** `body`/`message`, `title`/`headline`, `link_url`, or `image_hash` — the creative object only carries a `thumbnail_url` and the post reference (`effective_object_story_id`, `effective_instagram_media_id`). The actual copy, destination link, and (for non-video posts) image live on the underlying Page/IG post, not the creative, and this toolset has no "fetch post content" call for that. |
| `VIDEO` (direct video upload creative) | 29 (15%) | Full `body`, `title`, `video_id`, `call_to_action_type` present. Good. |
| `PRIVACY_CHECK_FAIL` | 7 (4%) | Despite the alarming name, this is just a Meta creative-review-flag object type — `body` and `call_to_action_type` were still present, `image_hash`/`video_id`/`link_url` were not. |

Net effect: **`link_url` was `0/194`** across every creative regardless of type — the
`ads_get_creatives` tool simply does not surface it in this account's API responses.
`image_hash` was present on only 12/194 creatives (all direct-upload static images);
`video_id` on 29/194 (all `VIDEO` type). The destination URL / UTM parameters for the
158 `SHARE`-type ads are **not in `manifest.json`** and will need to be pulled from
Ads Manager's UI (Preview pane shows the live link) or from the connected Shopify/GA4
UTM records, ad by ad, at rebuild time.

**What was derived instead, as a partial mitigation:**
- `page_id` was back-derived from `effective_object_story_id` (format `pageid_postid`).
  Only **2 distinct Page IDs** appear across all 198 ads: `225761664423003` and
  `333868123152090` — manageable to confirm manually.
- `instagram_actor_id` could not be derived (only the IG *media* id is exposed, not the
  IG *account* id) — recorded as `effective_instagram_media_id` instead, flagged in the
  manifest.
- `thumbnail_url` (a Meta-hosted preview render, not the original asset) is present on
  every creative and kept in the manifest for visual reference even where the real
  asset isn't identifiable.

**Action needed before rebuild:** for each of the 158 `SHARE`-type ads, someone needs to
open the ad in Ads Manager (or use the `effective_object_story_id`/
`effective_instagram_media_id` to look up the live post) and copy the primary text,
headline, destination link + UTMs, and image/video by hand, OR treat these as
"repost the same live post" rebuilds (only possible if the target Business Manager has
permission on the source Page — see plan §5, "Reusing existing posts").

---

## 4. Distinct assets catalogued (metadata only — no binaries downloaded)

Per the task brief, this step only catalogues hash/id + available metadata. **Downloading
the actual image/video files is a separate follow-up step**, not part of this export.

- **12 distinct image hashes** — fetched via `ads_get_ad_images`. 11 of 12 returned full
  metadata (name, url, permalink_url, width, height). One hash
  (`8c91eb4eefba7c50fca2f8c7b9433be5`) was **not returned** by `ads_get_ad_images`
  (likely archived/inactive) — its `url` was recovered as a fallback from the
  `image_url` field on the one creative that references it (`1542895417363751`,
  "5 Perfumes for $100 + Free $30 Gift"). Flagged in `manifest.json` under that image's
  `status` field.
- **29 distinct video IDs** — fetched via `ads_get_ad_videos`, all 29 returned full
  metadata (title, permalink_url, thumbnail picture, length in seconds).
- In `manifest.json`, every asset has `file: null` and `sha256: null` — correct per the
  schema, since nothing has been downloaded yet.

---

## 5. Ads with failed creative fetch

**None.** All 198 active ads resolved to a `creative_id`, and all 194 distinct
`creative_id`s returned a record from `ads_get_creatives` (0 hard failures). The two ads
that were initially missing from the bulk `effective_status=ACTIVE` filter —
`120245882725780605` ("B19 — 04 5-for-$100") and `120245882701040605`
("B19 — 02 5-for-$100"), both in the TESTING campaign — were caught by a follow-up
targeted fetch by ad ID and are included in the final manifest with no data loss.

The "failures" that exist are **field-level gaps within otherwise-successful fetches**
(sections 2 and 3 above), not missing records.

---

## 6. Readiness note for rebuild phase

- **Structure (campaigns → ad sets → ads → creative links):** ready. All 245 nodes
  (8 + 39 + 198) are in `manifest.json` with `source_id`s intact for traceability.
- **Budgets / bid strategy / objective:** ready at campaign and ad-set level.
- **Ad set targeting:** **blocked** — needs manual documentation per ad set (Gap #2).
- **Creative copy + destination links:** **partially blocked** — solid for the 31
  video-based/PRIVACY_CHECK_FAIL creatives (16 + 4% ≈ 36 of 198 ads), **needs manual
  pull for the ~160 boosted-post ads** (Gap #3).
- **Media assets:** catalogued (hash/id + URLs), **not yet downloaded** — next step is
  to fetch the 12 image URLs and 29 video sources into `images/` and `videos/` per the
  plan's storage layout, then compute `sha256` for de-dupe, before this can go to Drive.
- **Pixel, custom conversions, custom audiences, Pages, IG accounts (plan §2 steps
  8–10):** intentionally out of scope for this pass — `reference` block in
  `manifest.json` is empty with a note. Needs a follow-up crawl before Phase 2 rebuild.

**Bottom line:** the account *shape* (what campaigns/ad sets/ads exist and how they
relate) is fully captured and rebuild-ready. The *content* needed to actually recreate
each ad (targeting + creative copy/link) has a real, non-trivial manual-documentation
tail — roughly 39 ad sets' worth of targeting and ~160 ads' worth of copy/link — that
no available API call in this toolset could close. Budget that manual pass before
scheduling the rebuild session.
