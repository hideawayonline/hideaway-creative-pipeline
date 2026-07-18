# Meta Business Asset Transfer Checklist — Squad Tour Pty Ltd → Scent Stars

Order-of-operations for moving `hideaway.online`'s Meta assets from the current owning
business (**Squad Tour Pty Ltd**) to the new Business Manager (**georgiesmum** business
portfolio, home of the **Scent Stars** ad account) once the sale completes.

Companion to `docs/ad-account-clone-plan.md` (the ad account structure/creative clone) —
run this checklist first, since the ad account rebuild depends on the Page, pixel, and
domain already sitting under the new business.

**Golden rule: claim first, release second — never the reverse.** Releasing a Page/IG
account from the old business before the new business has successfully claimed it can
leave the asset without an owning BM mid-transfer, which breaks ad delivery, catalog
sync, and WhatsApp/commerce integrations tied to it.

**Never delete a Page or Instagram account.** "Delete" destroys the asset — followers,
post history, reviews, ad history — irreversibly. Every step below only ever *removes*
(unassigns) a Business Manager's ownership link; the asset itself keeps existing.

---

## Pre-completion (already done)

- [x] Scent Stars "backup pixel" seeding line removed from the Hideaway HW2 Meta Pixel
      custom script (`fbq('init', '978243568023663')`) — confirmed no new events routing
      to the Scent Stars dataset from the live site while the sale is pending.

## Sale-completion day — in order

### 1. Domain — `hideaway.online`
No cooperation needed from Squad Tour Pty Ltd; you control DNS directly.
- [ ] `Business Settings → Brand Safety and suitability → Domains → Add` (on the
      georgiesmum/Scent Stars business)
- [ ] Verify via DNS TXT record or HTML file upload
- [ ] Confirm status shows **Verified** under the new business
- [ ] *(Optional, once confident nothing else depends on it)* Remove the domain from
      Squad Tour Pty Ltd's Domains list — not required for Meta ads to function, since a
      domain can be verified under more than one business.

### 2. Facebook Page — "Hideaway Handmade"
- [ ] From georgiesmum: `Accounts → Pages → Add → Add a Page` → enter the Page name/URL
      → this sends a claim request
- [ ] From Squad Tour Pty Ltd (admin — likely you or Wendy Campbell per current access
      list): approve the request in Business Settings
- [ ] Confirm the Page now shows as owned by georgiesmum
- [ ] **Only then**, from Squad Tour Pty Ltd's Pages settings, click **Remove** —
      this is a *total* removal: Squad Tour Pty Ltd is left with zero access or
      ownership link to the Page. The Page itself is untouched (same URL, followers,
      posts, reviews, ad history) — it simply belongs to georgiesmum from this point on.
- [ ] Note: the people currently listed with access (Ashy Bines, Wendy Campbell, the
      Conversions API System User) hold that access *through* Squad Tour Pty Ltd's
      ownership — once removed, they lose access too unless separately re-added under
      georgiesmum. Decide who should carry over before this step.

### 3. Instagram account — `@hideawayonline`
Same claim → confirm → release sequence as the Page:
- [ ] From georgiesmum: `Accounts → Instagram accounts → Add` → claim `@hideawayonline`
- [ ] Approve from Squad Tour Pty Ltd's side
- [ ] Confirm ownership shows under georgiesmum
- [ ] **Only then** remove it from Squad Tour Pty Ltd's Instagram accounts list — same
      total removal, same access-cascade note as the Page above

### 4. Pixel / dataset reassignment
- [ ] Re-add the Scent Stars pixel init call to the Shopify custom pixel (or better: once
      the official "Facebook & Instagram" Shopify sales channel slot is free, connect the
      Scent Stars pixel there natively instead of via custom script)
- [ ] `Data Sources → Datasets & pixels` (georgiesmum) — confirm the Scent Stars dataset
      (`978243568023663`) is formally owned by georgiesmum, not just receiving events
- [ ] Decide: share the **old HW2 pixel** to georgiesmum to preserve conversion history,
      or run Scent Stars' pixel standalone from this point forward (see trade-offs in
      `docs/ad-account-clone-plan.md` §5)

### 5. Ad account structure
- [ ] Run the export → rebuild flow in `docs/ad-account-clone-plan.md` now that the
      Page, domain, and pixel all sit under the new business — campaigns/ad sets/ads
      build PAUSED, reference the new Page + pixel IDs

### 6. Audiences & billing
- [ ] Custom/Lookalike audiences: share from Squad Tour Pty Ltd to georgiesmum if history
      matters, or rebuild fresh off the (now-live) Scent Stars pixel
- [ ] Confirm payment method is live on the Scent Stars ad account before unpausing
      anything

### 7. Access cleanup
- [ ] Review who has admin access on georgiesmum vs. Squad Tour Pty Ltd — add the new
      team as needed, remove anyone who shouldn't retain access to the old business post-sale

---

## Post-transfer verification

- [ ] Page shows **Owned by: georgiesmum** (or the new business's actual legal entity
      name) in Business Settings
- [ ] Instagram account shows the same
- [ ] Domain shows **Verified** under georgiesmum
- [ ] Pixel Helper on the live storefront shows the Scent Stars pixel firing again
      (re-enabled deliberately, not by accident)
- [ ] A single test ad in the rebuilt Scent Stars ad account delivers correctly end to
      end before scaling any spend
