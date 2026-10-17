# v77: expense audit (paper towels, shelf liner, lunch, no candy, gas, booth + miles)

**Date:** 2026-10-17 · **Branch:** `claude/expense-audit-v77` · **App:** v76 → v77

## REQUESTED

Froggy: update every booth cost and the expenses for each show. Candy comes
off (not giving it away). Hard rules from now on:

- **Paper towels: 2 rolls per person per show day.** A 2-person booth at Cranberry
  went through 4 rolls a day. Priced from the average 6-pack of Bounty.
- **Shelf liner: 2 rolls every show.**
- **Gas** at a real price.
- **Lunch: $20 every show day.**
- Fill every blank the app can, and audit the math.

## COMPLETED

**New overhead model** (`showPaperRolls`, `showPaperCost`, `showLinerCost`, `showLunchCost`):

| Item | Rule | Price used |
|---|---|---|
| Paper towels | 2 rolls × people working × show days | Bounty Select-A-Size 6 double rolls, **$17.50/pack** ($2.92/roll). Oct 2026 street prices ran $11.77 (H-E-B) to $24.49 (Walmart), ShopRite $14.49, Walmart 3rd party $18.99 |
| Shelf liner | 2 rolls per show | **$12.49/roll** (Duck Select Grip EasyLiner 20 in x 18 ft, Sam's 2-pack $24.98) |
| Lunch | $20 × show days | skipped on a show where real food was already logged, so Cranberry's food receipts are not doubled |
| Candy | **removed** | `candyPerShow` gone from code, settings and the supply list |

People working = the show's crew (active or not, it is history) + Froggy unless the
show is crew-run. Missed and passed shows carry none of it. All three prices are
editable in Setup → Show Supply Costs. Paper + liner sit in Supplies; lunch is
its own line on the expense receipt, break-even, P&L tab and P&L CSV.

**Bugs found and fixed in the audit:**

1. **Break-even double-counted gas** on any show with a Fuel receipt (Cranberry):
   the receipt was in "other expenses" and the mileage estimate was added on top.
   Now a logged fuel receipt or day gas IS the gas, the estimate fills in only when none is logged.
2. **Break-even ignored money logged on the day screens** (gas/food/parking/hotel on `d.expenses`). Now included.
3. **Gas estimate ignored `totalMiles`** (the real route) while the screen showed it.
   `showGas` now uses `showMiles`, same as the miles on screen and the IRS deduction.
4. The snapshot engine (`bxView`, used by exports and the self-check) mirrors all of the above.

**One-time data fill** (`expense_audit_v77`, runs last in `applyOneTimeUpdates`, waits for a board with shows, fills blanks only):

- Gas default **$3.50 → $4.20** (AAA WI: Oct 9 $4.15, Oct 16 ~$4.25). A price Froggy set himself (anything but 3.50) is kept.
- Every **finished** show with no gas price of its own is frozen at its month's WI average
  (May 3.85, Jun 3.95, Jul 4.03, Aug 4.05, Sep 4.30, Oct 4.20) so history does not move with the default.
- **Booth fees** (Rustic Fox 2026 season, invoice "total 60 USD"):
  Carol Stream Aug 2, Sep 6, Oct 4: **$60 each, paid**. Fox & Found N. Aurora Oct 17: **$60 owed**
  (final invoice sent Sep 30, amount assumed = season rate, note says check the invoice).
- **One-way miles** from Waterford where blank: Polish Fest 32, Maxwell Street 14, Waukesha Co Fair 22,
  McHenry Co Fair 45, Burgoo 150, Baraboo 110, Cranberry 180 (+ town fallbacks). Miles and the gas
  freeze are shape-driven (`v77FillBlanks`, every load) so a re-seeded or restored show gets them too.
- Supply list: Candy/Mints out, Paper Towels (Bounty) + Shelf Liner in.

## FROGGY'S ANSWERS (Oct 17, same PR)

- **St. Martins Fair, Sep 6: booth $245, paid.**
- **Fox & Found Oct 17: $60 confirmed** (still owed in the app until paid).
- **Burgoo: drove home every night**, so 150 x 2 x 2 days = 600 mi stays.
- **Pre-contract markets passed** (never deleted, Restore any time): Rustic Fox Carol Stream May 3, Jun 7, Jul 5;
  Fox & Found N. Aurora May 23, Jun 20, Jul 18, Aug 15, Sep 19.
- **No holiday markets this year except one at Carol Stream.** Sip & Sleigh N. Aurora, Kris Kringle Carol Stream
  and Kris Kringle N. Aurora are passed. **Sip & Sleigh Carol Stream stays** on the board, booth $0.

**Open:** the only Rustic Fox holiday email in Gmail (Aug 10, "Pop Up Applications Open") says the 2026
holiday pop-up is a one-day Saturday market in **North Aurora**, and that none will be held at Carol Stream.
No acceptance or invoice for a holiday market was found. Froggy needs to confirm the date, town and booth fee.

## VERIFIED

`node tests/expense-audit.test.js` 34/34 (new). Every other suite matches unmodified `main`
(same pre-existing failures: passed-not-doing 5, product-debt-invoices 3). replay-guard 157/157.
Booted in Chromium: v77, no page errors; Setup shows the three new prices, the show receipt shows
paper rolls / liner / lunch, the P&L tab reconciles with a Lunch line.

**Live data changed:** No Supabase read or write. The fill runs on Froggy's device the first time the app opens after merge.
