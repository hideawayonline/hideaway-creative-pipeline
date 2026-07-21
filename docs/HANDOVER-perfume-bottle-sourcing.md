# Handover — Perfume Dupe Bottle Sourcing (21 Jul 2026)

Pick-up-and-run summary for whoever (or whichever session) continues this work.

## The brief

Steve (steve@hideaway.online) wants **genuine empty designer perfume bottles** — one of each fragrance his hideaway perfume range dupes — as props for marketing videos/images (dupe bottle beside the hideaway product, per house creative style). Bought as cheaply as possible, delivered to his home address (Mermaid Waters QLD, postcode **4218** — full street address known to Steve; deliberately not committed to the repo).

Hard rules agreed with Steve:
- **Genuine bottles only — no replicas/lookalikes.** (Explicitly confirmed; lookalike routes were researched then removed.)
- **Steve makes all payments himself.** Claude's job ends at "here's the listing, here's the offer amount, here's the message to paste."
- Keep his full street address out of committed docs; postcode 4218 in postage scripts is fine.

## What's done

1. **Range mapped from Shopify** (store is connected via MCP): 108 products in the Perfume collection → **36 designer-inspired scents → 24 distinct bottles to buy** (5 Kayali dupes share one bottle; 4 Tom Ford dupes share the Private Blend bottle; Black Opium covers Sweet Chaos/Neon since Neon empties don't exist). Full map + the no-designer-needed house scents list is in the sourcing sheet.
2. **Market research completed** (4 parallel research agents, 21 Jul 2026): per-bottle availability, AUD price targets, and routes. Key findings:
   - Easy/cheap ($10–30): Black Opium, Coco Mademoiselle, Chanel Allure, Daisy, Flowerbomb, Lady Million, Mon Paris, Armani Si, Boss Bottled, Jimmy Choo Man, Polo Blue, Versace Man, Pink Sugar.
   - Moderate (used/near-empty genuine bottle is the play): Alien, Olympea, Burberry Her, Miss Dior 2024, MJ Perfect (Intense empties unfindable — standard Perfect reads identical), Tiffany, GIAW (no empties exist — buy used full and decant), Bianco Latte (US seller, 40+ sold, ~US$22), Kayali (empties barely exist; used bottle $20–40).
   - Rare/pricey (saved-search alerts): Baccarat Rouge 540 ($70–130), Tom Ford ($40–70), Aventus ($60–90), Santal 33, Cry Baby Milk ($60–120), Mango Skin (zero empties anywhere — watch for ANY empty Vilhelm, identical flacon).
   - Budget: ~$350–500 realistic with lots/bundling; $550–800 buying individually. Postage ($8–12/seller) is the biggest cost lever — bundle lots and combined postage beat haggling.
   - Caveat: all marketplaces 403'd automated page checks, so listing links are search-snippet-sourced and marked *(unverified)*; the eBay AU search URLs are the durable tool.
3. **Deliverable written and committed:** `docs/perfume-bottle-sourcing.md` — scent→bottle map, 3-tier shopping list with eBay AU search links + target prices, negotiation playbook (Best Offer script, combined-postage script with postcode 4218, FB Marketplace search terms/messages/wanted-post), offer maths (offer 55% of ask, accept counters ≤80%), and a 30-minute buying-run checklist.
4. **PR:** [#11](https://github.com/hideawayonline/hideaway-creative-pipeline/pull/11), draft, branch `claude/perfume-bottle-sourcing-r52xac`, base `claude/update-env-credentials-qMpDd` (repo's default branch). Mergeable, no CI in this repo, no review comments as of handover. Session was subscribed to PR activity.
5. **Steve's first buy identified:** a live FB Marketplace listing ("Empty Perfume Bottles", $12, seller Deb, 5 genuine bottles incl. **Viktor & Rolf Flowerbomb** = the Flower Power dupe). Recommended: offer $10 or just pay $12.

## Open items / next steps

1. **eBay live-verification pass (blocked, unblock in progress).** This cloud environment's network policy is **Trusted**, which 403s eBay/Gumtree at the proxy — headless Chromium works (use `executablePath: '/opt/pw-browsers/chromium'` with the scratchpad Playwright install; the npm-installed browser version mismatches) but can't tunnel out. Steve was given steps to switch the environment's Network access to **Full** (or Custom with `*.ebay.com.au`, `*.ebay.com`, `*.ebayimg.com`, `*.gumtree.com.au`). **The policy applies when a container starts, so a fresh session is probably needed after he changes it.** Then: drive the browser over the Tier 1 (and lot) searches, filter Item location: Australia, sort Price + postage lowest, and upgrade the sheet to specific live listings with exact prices/postage/Best-Offer flags. Expect eBay bot-detection; use realistic UA/locale/viewport.
2. **Steve runs the 30-minute buying run** (section 4 of the sourcing sheet). Nothing blocks this — it's his part.
3. **Facebook Marketplace automation:** not possible from cloud sessions (his login, his laptop). He was pointed at the **Claude for Chrome extension** (claude.ai/chrome) to have Claude work inside his logged-in browser; alternatively he runs the searches manually with the scripts in the sheet.
4. **Scheduled PR check-ins: none.** A send_later check-in fired once (PR unchanged); Steve **declined** re-arming the hourly timer — don't re-create it. PR webhook subscription handles comments/reviews.
5. **When bottles arrive:** offered next step is planning the shoot list — pairing each dupe bottle with its hideaway product per the house style (see `hideaway-static-batch` / `higgsfieldnano` skills: real product cut-outs only, dupe bottle beside product).

## Gotchas for the next session

- WebFetch to hideaway.online 403s (bot-blocked) — use the Shopify MCP for anything store-related.
- eBay/AliExpress/Etsy/Gumtree 403 server-side WebFetch too; WebSearch snippets work.
- Repo default branch is `claude/update-env-credentials-qMpDd` (not `main`) — PRs must target it.
- Steve's messages are voice-to-text; read for intent, confirm when ambiguous.
