# v84 auditor pass: money checks with one-tap fixes, plus common-day polish (Oct 18 2026)

| | |
|---|---|
| **Branch** | `claude/auditor-v84` |
| **App version** | v83 → **v84** |
| **Tests** | `node tests/auditor-v84.test.js` (23 checks) |

Froggy: "Go through it again like an auditor determined to find something wrong. Fix it and make it bulletproof. Polish the whole app. Go through a common day. Make it easy to use."

## What the audit re-checked on the Oct 17 board (all hold)

- **Gross is correct three ways:** the day totals, the booth drawers and the engine all agree on every show. Card sales tax is card × 5/105 and card fees are card × 3%, both exact.
- **Units sold** match the booth-by-booth count to the bottle (Cranberry was checked by hand).
- **Cranberry prices** sit at regular prices because of Froggy's v52 instruction. Customers paid Cranberry prices, so collected beats "full price" by $1,860. Profit uses money collected, so it is not affected.
- **No duplicate business purchases.** The same amount twice is a monthly insurance bill and two separate bag orders.
- **The P&L reconciles, the engines agree, and a second load changes nothing.**

## Money problems the app never checked (it only audited stock)

`auditMoney(sh)` runs on every show, including shows settled by the Sep 23 recount, plus a check across all reps. Each flag carries one-tap `fixes`:

| Code | Catches | One tap |
|---|---|---|
| `countNoMoney` (red) | a day sold product but $0 money (Fox & Found Oct: 90 units, $1,235 at full price) | 💵 Enter the money |
| `repOnlyUnset` (gold) | only reps on the crew, but the owner's lunch and paper are charged (10 shows on the board) | "Rep-only: I was not there" (then asks if he covered the rep's gas; no sets `repGasPaid:false` and drops the gas) or "I was there" (adds him to the crew) |
| `zeroSale` (gold) | closed with nothing sold (Fox & Found Sep: $1) | "It did not happen" moves it to Missed and clears the placeholder $1 money and pay |
| `repOverpaid` (gold) | paid more than the pay entered (Andre +$252: a missing day pay, or a payment logged twice) | Open Reps |

- **Closing a show** no longer blocks on missing money. It shows a gold reminder instead, because stock can go home before the money is in.
- **Rep payments with no show** are linked once by `link_rep_payments_v84`, but only when exactly one show's unpaid balance equals the payment. Linked: Isaiah $500 (Rustic Fox Jun) and $225 (Polish Fest), Anthony $174 (Polish Fest), Andre $100 (Kane Jun). T.J. $181 and Andre $727 have no exact match and stay as they are.
- **`repOwedWhere`** lists which shows a rep is owed for. Unlinked payments and overpaid shows settle the oldest balances first, so the list always adds up to the total. T.J. reads "Burgoo $30.62", not McHenry $331.

## Common-day polish

- **Number boxes:** tapping a 0 clears it so typing doesn't produce "0250". Tapping any other number selects it, and leaving a box empty puts the 0 back. Checked on phone (tap) and desktop (click).
- **Money screen:** a live line under the total says matches, $X short ("Discounts? Recount if not.") or $X over.
- **Shows list:** a running show sits on top under "🔴 Happening now", above the booking pipeline, and is listed once.
- **Closeout step 4** on pay-rule shows reads "Rep pay: filled in from the money", not "enter flat $".
- **Reps:** payouts show which shows the money is for. Each card shows the rep's %. People with no shows or pay (Batman) move to one line.
- **Wording:** the banner reads "N things to check" and the audit is "Audit: stock + money", red first.

## Re-runs on this build (local, real board)

- Every button on every screen, 552 taps: same 5 harness-only quirks, no app errors.
- A full 2-day weekend: the garage matches to the bottle.
- Stress cases (wrong pack, double taps, reopen, rain date, typo, 2 booths): all pass.
- Year net is unchanged at **$8,335.99** until Froggy answers the flags.
