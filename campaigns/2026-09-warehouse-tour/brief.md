# Campaign brief — Inside the warehouse

**Status:** Draft copy, ready for review
**Channel:** Email (Klaviyo)
**Proposed send:** Thu 11 Sep 2026, 7:00pm AEST
**Source content:** Warehouse tour reel, @hideawayonline (38.2K views, 210 likes, 25 comments, 38 shares)

---

## Built in Klaviyo — draft, unscheduled

Created 9 Sep 2026. **Status: Draft. `send_time: null`, `scheduled_at: null`.** It cannot
send without someone deliberately scheduling it in the UI.

| | |
|---|---|
| Campaign | `01M21WT046BX329SJDZ1371PM4` — [open in Klaviyo](https://www.klaviyo.com/campaign/01M21WT046BX329SJDZ1371PM4/wizard) |
| Message | `01M21WT04EB2Q8QTQ8GCE3JZKN` |
| Template (library) | `W5dTqJ` — [edit](https://www.klaviyo.com/email-editor/W5dTqJ/edit) |
| Template (campaign copy) | `Yagy9J` — Klaviyo clones on assign; **the campaign renders this one**, so edit it from inside the campaign, not the library copy |
| Audience | `TtdqT4` — 🎯 Engaged REAL (~25,000) |
| Send strategy | Static, Thu 11 Sep 2026 09:00 UTC = **7:00pm AEST**. Stored as intent only — not scheduled |
| Smart sending | On |
| From | Hideaway &lt;no-reply@hideaway.online&gt; |
| Reply-to | hello@hideaway.online — set deliberately so replies land somewhere real, since replies are a success measure |
| Subject | Come see where it's actually made |
| Preview | We filmed the whole warehouse. No stylist, no staging. |

**The creative opens with a dark red DRAFT — NOT READY TO SEND banner** listing the four
outstanding items, plus a dashed placeholder where the hero image goes and a red note under
the tour button. All of it is designed to make an accidental send obvious before it happens.
Delete the banner once the four items are cleared.

Live links already wired: **Shop the range** → `hideaway.online/collections/perfumes`
(111 products), plus **Watch the tour** and the **P.S.** → the reel permalink. No dead
links remain; only the hero image is still a placeholder.

Note: Klaviyo's sanitiser strips an `<a>` wrapped around a `<table>`, so the hero
placeholder box itself isn't clickable. Once a real `<img>` replaces it, wrap that image
in the anchor and it behaves normally.

Not yet built: **subject line B as an A/B test**, because the comms review may change the
copy. Worth adding once the wording is signed off.

---

## Why this email, and why now

On **30 Aug** the ownership update went to the full file — **118,347 recipients**, subject
line *"Hideaway is still trading and we are here to stay"*, signed **Chris Dobson, CEO**.

It opened at **57.7%** (vs. our usual 34–38%). The list was paying close attention.

Two other numbers from that send matter:

| Metric | CEO letter (30 Aug) | Typical campaign |
|---|---|---|
| Recipients | 118,347 | ~25,000 |
| Open rate | **57.7%** | 34–38% |
| Click-to-open | **0.17%** | ~1.1% |
| Unsubscribe rate | **0.73%** | 0.08–0.10% |

Roughly **860 people unsubscribed** off that one send — about 8x our normal rate.

Read together: a large part of the list opened because they were worried, read a
statement, and got no proof. Some of them left.

**A letter is a claim. A warehouse tour is evidence.**

This is the follow-up chapter — the same message, shown instead of said. It is a trust
email, not a promo. Revenue is the second-order effect, not the ask.

## What the 30 Aug letter actually said

This matters, because the copy references it directly and must not contradict it or
overclaim beyond it. Verbatim from the sent template:

> Following the recent media coverage regarding the liquidation of Platinum Investment
> Group Pty Ltd (the company which previously operated Hideaway Online), the business is
> transitioning into a phase of new ownership, during this time orders continue to flow
> in and dispatch daily from our warehouses. All existing customer rewards and points
> will transfer and continue to accumulate.
>
> [...] The brand, the website, social pages, our exciting product range, in store sales
> and everything you love about Hideaway still remains!!
>
> Warmly, **Chris Dobson, CEO**

Three constraints fall out of that:

1. **The previous operating entity was liquidated.** Any claim of unbroken historical
   continuity ("everything you've ever ordered came from this building") is unsafe and
   probably untrue. The copy speaks in the **present tense** only.
2. **The letter says "warehouses", plural.** Don't imply a single site is the whole
   operation.
3. **The letter was signed by Chris, not Steve.** A first-person callback ("I wrote to
   you") only works over Chris's signature. The draft uses "we" so it works either way.

The safe ground is exactly what the letter already claimed publicly and what the footage
independently shows: **stock on shelves, orders dispatching daily, real staff at real
desks, product made by hand.** Stay on that ground and the email is both true and strong.

## The strategic call

Do **not** send this as "fun behind-the-scenes content". Send it as the receipt.

> We said we're here to stay. Here's the building.

That framing does three jobs at once:
1. Closes the loop the CEO letter opened, for the people who wanted more than words.
2. Re-warms the worried-but-still-subscribed cohort before they churn too.
3. Gives an easy, low-commitment click ("watch the tour") into a page that also sells.

## The one structural change worth making

Our click-to-open rate is sitting at **~1.1%** across recent campaigns. People open and
don't click. Sending them off to Instagram would make that worse — the session ends on
someone else's platform.

**Recommendation: host the tour on our own site.**

Create `hideaway.online/pages/inside-the-warehouse` with:
- The reel embedded at the top (self-hosted or Shopify-native video, no IG embed)
- Two or three lines of copy underneath
- The full range as a product grid below it

Then the email's primary CTA points there, not to Instagram. Same emotional payoff,
but the click lands somewhere that can convert, and we own the traffic.

If the page can't be built in time, ship the email anyway and point the CTA at the
collection page with the reel as a linked GIF. Don't hold the send for it.

## Linking the reel

**Permalink:** https://www.instagram.com/reel/DdA5Ndzit-M/
Posted 8 Sep. 211 likes, 25 comments. **Runs 1 min 43 sec.**

Both links in the draft are now wired to it — the Watch the tour button and the P.S. —
so nothing in the email is dead. But Instagram is the fallback, not the destination.

### Why the on-site page still wins

- **Desktop is the problem.** A logged-out visitor clicking through to a reel gets
  Instagram's login overlay rather than the video. A meaningful slice of email opens are
  desktop, and those people hit a wall instead of the proof we promised them.
- **The session ends on Instagram.** They watch, they scroll, they're gone. No product
  grid, no path back, nothing to buy.
- **No visibility past the click.** Klaviyo records the click and that's the end of the trail.

On mobile with the app installed it deep-links fine, so it isn't broken — it's just leaving
most of the value on the table for a page that takes about an hour to build.

### Getting the video file

Instagram's CDN is locked down, so the file has to be pulled by someone with account access:

- **Meta Business Suite → Content → Reels →** find the 8 Sep warehouse tour → Download.
  Cleanest option, full quality.
- **Or the Instagram app:** your own post → ⋯ → Download.

Then upload to **Shopify → Content → Files** and embed with a native `<video>` tag. Don't
use an Instagram embed — it pulls in their script and can show a login prompt.

### A note on the length

1:43 is long for an email click-through. For a promo that would be a problem. For this one
it's probably fine — people who are worried about whether you're still trading will watch
the whole thing, and the length is itself part of the proof. Worth cutting a 15-second
version for the hero GIF if there's time, but don't hold the send for it.

## Audience

**Primary:** `🎯 Engaged REAL — clicked 90d OR ordered 180d (subscribed, no MPP opens)` (~25,000)

**Second wave (48h later, optional):** people who **opened the CEO letter but have not
ordered since 30 Aug**. That is precisely the reassurance-needed cohort, and it is the
highest-value audience for this specific message.

**Do not** re-blast the full 118K file. We spent that card on 30 Aug, and it cost us
860 subscribers. Deliverability needs the recovery time.

## Timing

Thu 11 Sep, 7:00pm AEST — matches the hideaway fest send pattern, lands in the evening
scroll, and gives the weekend to run. Avoid a morning send; this is watch-something content.

## Subject lines

**A (lead):** Come see where it's actually made
**B (test):** We said we're here to stay. Here's the building.

Preview text: `We filmed the whole warehouse. No stylist, no staging.`

**Lead with A, not B — deliberately.** The callback belongs in the body, where only people
who open it will reach it. Roughly 42% of the file never opened the 30 Aug letter; for
them a subject line about still being here **creates** a doubt they didn't have. A is warm
and safe for that group, and the people who did read the letter still get the full payoff
in the first line of the email. B is worth testing on a holdout, not leading with.

Both are deliberately plain. Our best-performing recent subjects ("Midnight",
"I said there'd be no round three", "Dad's sorted. Now you.") work because they're
short and confident. No emoji in the subject on this one — the message is sincerity.

## Copy

Full body copy lives in `email.html`. Plain-text version below for reference.

```
Hey {{ first_name }},

A fortnight ago we wrote and told you Hideaway is here to stay.

Fair enough if you wanted more than a letter.

So we grabbed a phone and filmed the place. The front door. The office.
The benches where the perfumes get blended. The shelves your order gets
picked off.

No stylist. No staging. Just a normal day on the Gold Coast.

[ WATCH THE TOUR ]

What you'll see:

  - The bench where the fragrances get blended and bottled by hand
  - Shelves stocked, and orders going out the door daily
  - The desks where the team answers your emails, real people with real names
  - A very ordinary building doing a not-very-ordinary amount of work

Same building. Same team. Same hands making the same perfume.

We asked you to take our word for it. Now you don't have to.

[ SHOP THE RANGE ]

Steve
Founder, hideaway.

P.S. It's up on Instagram too and it's had a bit of a run. If you know someone
who reckons we'd disappeared, send it their way.
```

## Confirm before sending

- [ ] **Get this one past whoever handles the ownership comms.** The 30 Aug letter is a
      formal statement about trading status made during a liquidation of the previous
      operating entity and a change of ownership. This email references it. The copy has
      been written to stay inside what that letter already claimed publicly, but it is a
      marketing email touching a legally sensitive subject and it should have the same
      eyes on it that the letter did. This is the only genuinely blocking item.
- [ ] **Sign-off.** Draft signs "Steve, Founder" and uses "we wrote" so it works over
      either signature. Recommendation: **Steve signs it.** The letter was the formal CEO
      statement; this is the warm founder follow-up. Two named humans, different registers,
      is a good one-two. If you'd rather Chris signs, swap "we wrote" to "I wrote".
- [x] **"Same team." — confirmed 9 Sep.** The team in the footage is still the team, so
      the line stands as written.
- [ ] **Location.** Copy says "the Gold Coast", which covers both the Robina address on the
      Klaviyo account and the "handmade in Burleigh Heads" line from the Delicate Rose
      launch. Swap in the specific suburb if you'd rather be precise.
- [ ] **Video host.** Currently pointing at the Instagram reel so the email works as-is.
      Swap to the on-site page when it's built — see *Linking the reel* above.
- [ ] **Hero still.** Pull a frame from the reel — the front-door shot with the
      "welcome to hideaway" sign is the strongest opener.

## Success measures

This email is not judged on revenue. Judge it on:

- **Click-to-open rate** — target 5%+. Anything above our 1.1% baseline means the
  content is finally earning the click.
- **Unsubscribe rate** — target under 0.10%, back to normal. If this send is also
  elevated, the list damage from 30 Aug is still working through and we slow down.
- **Replies.** A trust email that gets replies is working. Watch the inbox.
