# High-Intent SMS List: Klaviyo → Kudosity (TransmitSMS)

Build a ~10k high-intent, **SMS-consented** list in Klaviyo and export it as a
CSV ready to upload at
[kudosity.transmitsms.com/u/messaging/campaign](https://kudosity.transmitsms.com/u/messaging/campaign).

## Budget reality check

| Item | Value |
|------|-------|
| Budget | **$345** |
| Single-part SMS (AU, Kudosity) | ~**3.45¢** |
| Max single-part sends | **~10,000** |

**Keep the message to ONE part.** A GSM-7 SMS is single-part up to **160
characters** — and that 160 must include your `Reply STOP` opt-out. Go to 161+
characters (or use emoji/special chars, which switch you to UCS-2 at **70 chars
per part**) and every message becomes 2 parts = **double the cost** (~$690 for
10k). The exporter caps the list to whatever your budget actually covers.

## Step 1 — Build the "High Intent SMS" segment in Klaviyo

Klaviyo → **Audience → Lists & Segments → Create Segment**. Name it
`High Intent SMS – BOGO`. Use **Definition** with these conditions:

**Required (legal — you may only SMS these people):**
- `Can receive SMS marketing` (this is consent = SUBSCRIBED) — **is true**

**AND high-intent (pick the ones that fit your data — these are OR'd as "any"):**
- `Started Checkout` **at least once in the last 30 days** (strongest intent — abandoned checkout)
- `Added to Cart` / `Checkout Started` in the last 30 days
- `Viewed Product` **at least 2 times in the last 14 days**
- `Active on Site` in the last 14 days
- `Placed Order` **at least once in the last 90 days** (recent buyers — great for BOGO)
- *(optional)* Predictive: `Predicted CLV` is greater than `<your threshold>`

> Tip: Start broad enough to clear ~10k people *after* the SMS-consent filter.
> If the segment is much larger than 10k, the script keeps the highest
> **predicted-CLV** contacts first, so you spend the $345 on the best names.

Open the segment and copy its **Segment ID** from the URL
(`.../segment/XXXXXX` — the `XXXXXX` part).

## Step 2 — Add your Klaviyo key

Klaviyo → **Settings → API keys → Create Private API Key** (read access to
*Profiles* and *Segments* is enough). Put it in `.env`:

```
KLAVIYO_API_KEY=pk_xxxxxxxxxxxxxxxxxxxx
```

## Step 3 — Export

```bash
pip install -r requirements.txt

# preview counts + cost, write nothing:
python klaviyo_sms_export.py --segment-id XXXXXX --dry-run

# write the upload-ready CSV (auto-capped to budget):
python klaviyo_sms_export.py --segment-id XXXXXX --limit 10000 --out sms_list.csv
```

What the script does:
- Pulls every profile in the segment (cursor-paginated, 429-aware).
- Keeps only `sms.marketing.consent == SUBSCRIBED` — **double safety on top of
  the segment filter.** Never message non-consented numbers.
- Normalises every number to **E.164** (`+614…`), drops landlines/invalids.
- De-duplicates by mobile.
- Sorts by predicted CLV and caps to your budget (`$345 ÷ 3.45¢ ≈ 10,000`).
- Writes `mobile,first_name,last_name`.

## Step 4 — Upload to Kudosity & send

1. Go to <https://kudosity.transmitsms.com/u/messaging/campaign> (or
   **Contacts → upload** to create the list first).
2. Upload `sms_list.csv`; map `mobile → Mobile Number`, `first_name → First Name`.
   Kudosity skips duplicates and non-mobiles automatically.
3. Compose the BOGO offer. Use `[firstname]` for personalisation and **end with
   an opt-out**. Example (151 chars — single part):

   > `Hi [firstname], Hideaway BOGO is on: buy 1 get 1 free, today only. Shop: hdwy.co/bogo Reply STOP to opt out`

4. Send a test to your own mobile, confirm it lands as **1 part**, then schedule.

## Compliance notes (AU Spam Act)

- Only send to contacts who **consented to SMS marketing** — the script enforces
  this, don't override it.
- Every message needs a **functional opt-out** (`Reply STOP`).
- Use an approved sender ID / number in Kudosity.
