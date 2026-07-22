# Theme fix: mobile Welcome Popup breaking product pages

## The report

An Instagram DM (21 Jul 2026) claimed that on mobile, every product page
"endlessly scrolls" and Add to Cart doesn't work.

## Root cause

`sections/popup-welcome-v2.liquid` (added to `layout/theme.liquid` on 3 Jul,
rendered on every page of the live theme "Hideaway — Homepage Founder Banner
Preview") has three mobile-specific defects:

1. **Broken scroll lock.** `show()` sets `document.body.style.overflow =
   'hidden'`, which iOS Safari and the Instagram/Facebook in-app browsers
   ignore. The page keeps scrolling behind the dimmed overlay while the
   full-screen overlay swallows every tap — experienced as "the page endlessly
   scrolls and you can't add anything to cart".
2. **Scroll trigger fires on every product read.** The popup opens at 30%
   page scroll; on a phone, reading a product description *is* 30% scroll,
   so it interrupted every PDP visit.
3. **Dismissal doesn't stick in in-app browsers.** Dismissal was stored only
   in `localStorage`, which Instagram's browser frequently drops, so the
   popup re-appeared on every page view for exactly the traffic most likely
   to hit it.

## The fix (`sections/popup-welcome-v2.liquid`)

- Scroll lock now uses the `position: fixed` body technique with scroll
  restoration, plus `overscroll-behavior: contain` on the overlay/sheet.
- The scroll-percent trigger is disabled on `/products/` pages (the timed
  trigger still fires once).
- Dismissal/subscription state is stored in both `localStorage` and a
  cookie; whichever survives wins.
- Inputs only auto-focus on desktop, so the mobile keyboard no longer pops
  over the bottom sheet.
- The sheet itself scrolls (`max-height: 100%; overflow-y: auto`) on short
  screens.

Everything else — markup, Klaviyo wiring, settings schema, copy — is
unchanged from the live version.

## How to apply

Shopify Admin → Online Store → Themes → live theme → **Edit code** →
`sections/popup-welcome-v2.liquid` → replace the entire file with the copy in
this folder → Save. No settings changes needed.

Instant mitigation without code: Customize theme → select the "hideAWAY
Welcome Popup V2" section → untick **Enabled** → Save.

## How to verify

- On a phone (ideally the Instagram in-app browser), open any product page,
  wait ~8s for the popup: the page behind must not scroll while it's open,
  closing it must restore scroll position, and Add to Cart must work.
- Microsoft Clarity is installed on the store — mobile PDP session
  recordings from 3–22 Jul will show the before/after.
