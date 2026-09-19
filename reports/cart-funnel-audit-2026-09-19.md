# Cart funnel audit — hideaway.online

**Date:** 19 Sep 2026 · **Store:** `hideaway-infinity.myshopify.com` (www.hideaway.online, Shopify Plus, AUD/AEST)
**Question:** did the changes we made to the cart help?
**Source:** Shopify ShopifyQL (`sessions`, `sales`), 27 Aug – 18 Sep 2026. Change dates corroborated from Slack.

---

## Verdict

**Yes — decisively. But not the changes shipped on 30 Aug. Those made it worse.**

Revenue per session went **$0.97 → $2.02 (+109%)**. Orders per day held flat
(64.0 → 65.2) while sessions fell 52%. The wins came from the 2 Sep reversal and the
9 Sep free-gift cleanup — not from the 30 Aug cart conversion build.

Estimated value at current traffic: **~$2,880/day, ~$87K/month.**
(27,546 sessions over 9–18 Sep at the old $0.97/session = ~$26,720 expected;
actual was $55,538.)

---

## Change timeline

| Date | Change | Effect on cart → checkout |
|---|---|---|
| 27 Aug | New store live (cutover) | baseline 45.5% |
| 30 Aug | Cart conversion build + shipping protection defaulted ON; UpCart rewards cut to free shipping at $150 | **fell to 36.8%** |
| 2 Sep | Reversal / fix | recovered to 49.7% |
| 9 Sep | Both $0.00 "free gift" products archived (were addable from search at any qty) | **jumped to 77.9%** |

## Funnel by window

| Window | Sessions/day | Add-to-cart | Cart→checkout | Checkout→order | CVR | Rev/session |
|---|---|---|---|---|---|---|
| **A** 27–29 Aug (pre cart-build) | 9,597 | 14.96% | 45.51% | 18.57% | 1.26% | $1.12 |
| **B** 30 Aug–1 Sep (cart build ON) | 5,699 | 13.11% | **36.81%** | 21.58% | 1.04% | **$0.97** |
| **C** 2–8 Sep (partial recovery) | 4,307 | 12.51% | 49.66% | 26.64% | 1.66% | $1.43 |
| **D** 9–18 Sep (post free-gift fix) | 2,755 | 10.78% | **77.91%** | 26.27% | **2.21%** | **$2.02** |

## Daily detail

| Date | Sessions | ATC% | Cart→CO% | CO→Order% | CVR% | Net sales | Orders |
|---|---|---|---|---|---|---|---|
| 2026-08-27 | 8,110 | 15.75 | 45.11 | 26.74 | 1.90 | $14,383 | 157 |
| 2026-08-28 | 13,390 | 14.74 | 45.90 | 15.01 | 1.02 | $11,741 | 141 |
| 2026-08-29 | 7,290 | 14.49 | 45.27 | 15.48 | 1.02 | $6,073 | 87 |
| 2026-08-30 | 6,855 | 13.58 | 37.27 | 20.75 | 1.05 | $6,444 | 74 |
| 2026-08-31 | 5,839 | 12.18 | 38.26 | 22.43 | 1.04 | $6,014 | 72 |
| 2026-09-01 | 4,403 | 13.60 | 34.39 | 21.84 | 1.02 | $4,041 | 46 |
| 2026-09-02 | 4,496 | 15.35 | 40.87 | 28.01 | 1.76 | $6,817 | 82 |
| 2026-09-03 | 4,727 | 12.88 | 44.99 | 33.21 | 1.93 | $8,463 | 104 |
| 2026-09-04 | 4,193 | 12.74 | 52.25 | 27.60 | 1.84 | $6,583 | 87 |
| 2026-09-05 | 3,922 | 13.79 | 48.43 | 20.99 | 1.40 | $4,658 | 58 |
| 2026-09-06 | 3,961 | 12.12 | 51.67 | 22.98 | 1.44 | $4,374 | 60 |
| 2026-09-07 | 3,862 | 10.93 | 60.19 | 27.56 | 1.81 | $5,867 | 76 |
| 2026-09-08 | 4,989 | 9.94 | 55.24 | 25.55 | 1.40 | $6,383 | 78 |
| 2026-09-09 | 3,696 | 11.61 | 72.73 | 25.00 | 2.11 | $7,116 | 83 |
| 2026-09-10 | 2,957 | 11.13 | 69.91 | 30.00 | 2.33 | $6,452 | 72 |
| 2026-09-11 | 3,184 | 11.68 | 73.39 | 19.41 | 1.66 | $4,854 | 60 |
| 2026-09-12 | 2,532 | 11.33 | 78.75 | 26.11 | 2.33 | $5,474 | 59 |
| 2026-09-13 | 2,983 | 10.02 | 74.58 | 29.60 | 2.21 | $6,090 | 69 |
| 2026-09-14 | 2,526 | 8.35 | 89.10 | 26.60 | 1.98 | $4,230 | 51 |
| 2026-09-15 | 2,311 | 11.47 | 85.28 | 24.78 | 2.42 | $4,911 | 62 |
| 2026-09-16 | 2,548 | 9.34 | 84.03 | 32.50 | 2.55 | $6,280 | 76 |
| 2026-09-17 | 2,392 | 10.83 | 82.24 | 24.88 | 2.22 | $4,604 | 54 |
| 2026-09-18 | 2,417 | 11.63 | 79.36 | 26.46 | 2.44 | $5,530 | 66 |

---

## Caveats — read these before quoting the numbers

1. **This is a before/after, not a controlled test.** Traffic fell 52% across the
   period, so mix changed underneath the rates.
2. **Part of the cart→checkout jump is denominator cleanup, not behaviour change.**
   Archiving the $0.00 free-gift SKUs on 9 Sep removed junk carts. Carts/day fell
   747 → 297 (-60%) while sessions fell 52%.
3. **But the uplift is still real.** Checkouts/day fell only 16% (275 → 231) against
   a 52% traffic drop, and orders/day *rose* 2% (64.0 → 65.2). Revenue per session
   doubled. That cannot be explained by cleaner counting alone.
4. Add-to-cart rate is drifting down (14.96% → 10.78%) and is worth a separate look.

---

## The remaining leak: checkout → order

Still only **26.3%**. Over 9–18 Sep: **2,314 sessions reached checkout, 608 ordered
— 1,706 lost.** At $85 AOV that is roughly **$145K of basket value abandoned at
checkout in 10 days.**

Lifting 26.3% → 40% (still below the 45–65% typical range) is worth
**~+32 orders/day ≈ $2,700/day ≈ $81K/month.** Zero ad spend required.

### By traffic source, 9–18 Sep

| Source | Sessions | Reached checkout | Orders | Checkout→order | CVR |
|---|---|---|---|---|---|
| direct | 12,799 | 893 (6.98%) | 200 | 22.4% | 1.56% |
| social | 9,451 | 714 (7.56%) | 163 | 22.8% | 1.72% |
| search | 4,955 | 684 (13.80%) | 239 | **34.9%** | **4.82%** |
| email | 85 | 11 | 2 | 18.2% | 2.35% |
| unknown | 256 | 12 | 4 | 33.3% | 1.56% |

- **Search converts 2.8x better than social** (4.82% vs 1.72%) and 3.1x better than
  direct, and it holds checkout far better (34.9% vs 22.8%). Paid social traffic is
  reaching checkout and bailing.
- **Email attribution is broken.** Klaviyo sent campaigns on 9 Sep and 14 Sep, yet
  Shopify recorded 85 email sessions across the whole 10 days. Those sessions are
  almost certainly landing in `direct` (the largest and worst-converting bucket).
  Email ROI is currently unmeasurable.

### Prime suspect for the checkout leak

UpCart promises **free shipping at $150**. If checkout then charges shipping — or the
threshold is calculated differently there — that is the classic mid-20s
checkout→order killer. Verify the promise in cart matches what checkout charges,
then check payment method availability.

---

## Microsoft Clarity — status

Clarity could not be used for this audit:

1. **Not connected.** No Clarity MCP server, no Clarity connector in Windsor.ai
   (only Meta, Google Ads, Instagram), and no Clarity token in this repo.
   Fix: generate a Data Export API token in Clarity → Settings, store it as
   `CLARITY_API_TOKEN`.
2. **Install status unverified.** The network egress policy blocks fetching
   hideaway.online, and the Shopify Admin token lacks the `scriptTags` scope.
3. **Most important — Clarity cannot record Shopify checkout.** Since
   `checkout.liquid` was fully retired, third-party JS in checkout runs through
   Checkout UI extensions / the Web Pixels API, which is sandboxed with no parent
   DOM access. Session recording needs DOM access. **So the single biggest leak
   (checkout→order, ~$81K/month) is invisible to Clarity by design.**

**Recommendation:** do not wire Clarity up in order to chase the checkout leak — use
Shopify's own checkout analytics and the abandoned-checkout records instead. Clarity
is still worth connecting later for the add-to-cart decline on PDP and cart, which it
*can* see.

---

## Also worth flagging

**Traffic is collapsing.** Sessions/day 9,597 → 2,755 (-71% since the cutover). The
cart is now converting well on far less traffic. That is the next fire and it is not
a cart problem.
