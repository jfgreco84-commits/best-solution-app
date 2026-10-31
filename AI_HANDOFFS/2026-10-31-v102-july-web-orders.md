# v102: two July website orders

**Date:** 2026-10-31 · **Branch:** `claude/royale-events-four-shows-g16qz8` (continued from `main` after PR #102 merged) · **App:** v101 → v102

Froggy sent the Formspree order emails from bestsolutionpolish.com: "These were online orders as well."

| id | Date | Products | In | Paid by | Ship to |
|---|---|---|---|---|---|
| `ol_2026_07_07_web` | Jul 7 2026 | 1 x 8oz | $25 | Venmo | Oregon IL |
| `ol_2026_07_20_web` | Jul 20 2026 | 1 x 8oz + 1 x 2oz | $40 | Cash App | Hudsonville MI |

Migration `july_web_orders_v102`. Both had free shipping for the buyer. **Postage is left at $0** because what Froggy paid wasn't given. The note on each sale says to add it with ✏️.

**Garage not moved.** These went out in July. The Sep 23 recount and the Oct 22 hard count already reflect those bottles being gone, so taking them off again would double-count.

**No customer names, emails, phones or street addresses in the code.** This file is served publicly. Buyer reads "Website order, Oregon IL" and so on, the same way the AZ sale was stored.

**Dedupe:** skipped if the id is there, or if a sale with the same amount and exactly the same products is within 10 days (he typed it in himself).

## Verified

`tests/july-web-orders-v102.test.js` 11/11. Same pre-existing failures as `main` (passed-not-doing 5/430, product-debt-invoices 3/109, gas-area-v93 1/40). Loaded in Chromium: v102, no page errors. No Supabase read or write.
