# v48: fixes from the two-pass audit

**Date:** 2026-09-26 · **Base:** v47 · **App version:** v47 → **v48**

## Requested

"Do a full app audit and run it twice. Don't let any discrepancies slide. Look at it like a financial expert."

## How

Two independent audit agents (money/P&L; end-to-end 3-day, 3-booth show with conservation asserted at every step) wrote runnable repros on synthetic data. Froggy then sent his real backup; the Cranberry show was checked against it too (not committed). Every finding was verified, fixed, and both repro suites re-run against v48.

## Fixed

| # | Problem | Fix |
|---|---|---|
| 1 | Show CSV + printed show report priced units at normal prices, not show prices | `_psPrice(sh,k)` |
| 2 | Day screen COGS and break-even used today's cost, not that day's schedule / per-show override | `calcCOGSOn(..., showDayKey(sh,di), sh)` |
| 3 | Booth Money screen "Expected" ignored booth-to-booth moves | `boothSold(d,boothId)` |
| 4 | Booth ending above what it had: silent, hides a sale, and a truck "fix" erased it for good | `boothOverEnd` red audit finding; `fixPackedFromTruckCount` refuses until the pull is logged as a restock |
| 5 | Fuel receipt + auto gas estimate both charged | Fuel-category show expenses count as hand-logged gas (calcShow and the V port) |
| 6 | Day Expenses pre-filled one day's gas; saving food replaced whole-show gas | gas field blank, estimate as placeholder; uses show MPG / gas price |
| 7 | Season CSV / print rows didn't add to the season total; passed shows charged $30 candy/paper | rows = running + completed shows, plus "Future shows: deposits" and "Business purchases" rows; no overhead on passed shows |
| 8 | Tax reserve summed per show (losses never offset wins); labels wrong | 28% × max(0, year net profit); labels fixed |
| 9 | P&L tab lines didn't add to Total Expenses | lines built from calcShow parts; a red line appears if they ever disagree |
| 10 | Scoreboard credited one drawer to two teams / dropped a drawer when one person helped another booth | `dayTeamBooths`: each booth to one team per day by crew majority; "not on any team yet" gap line so teams + gap = gross |
| 11 | Cash check silent when a drawer has money but nothing sold | reports "over" |
| 12 | Later truck fix re-flagged an earlier, correct truck count and offered a fix that flipped it back; closed shows kept truck alarms | fixes mark earlier counts `superseded`; no truck alarms on completed shows |
| 13 | App-filled next-day opening did not follow a corrected close | `morningSeeded` flag; cleared when someone counts the opening |
| 14 | Lost/damaged logged on an open day still counted at the show | subtracted in `truckShowOnHand` until close |
| 15 | Show stock card had no Lost column | added when anything was lost |
| 16 | Home "upcoming deposits" included the running show's booth | excluded |
| 17 | Labels: day "Net Profit (cash)" → "This Day's Net (before show-wide costs)"; units card label | relabelled |
| 18 | Truck fix after a partial pack: garage may still hold the extra | warning in the fix modal to recount the garage |

## Deliberately not changed

- Day sold on booth days stays the rolled-up count. Summing per-booth clamps was tried; it breaks the transfer-undo invariant and is not "right" either. The honest fix is #4: the red flag + blocked truck fix make the owner log the pull, after which every number is exact.
- Teams with no booth marked on a day show $0 that day (crews rotate). The gap line says how much is unassigned.

## Verified

`tests/audit-v48.test.js` 16/16 (new). All suites pass except the same date-sensitive `passed-not-doing` and `product-debt-invoices` failures as main. Pass 1 repros: all fixed except the two deliberate items above. Pass 2 e2e: conservation holds at every step; only remaining failures are the unmarked-team days. Real Cranberry data in Chromium at 390px: v48, no page errors, audit clean.
