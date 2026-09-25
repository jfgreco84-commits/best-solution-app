# v43: the truck at the top of the show screen

**Date:** 2026-09-25 · **Base:** `fc5a53c` (v42) · **App version:** v42 → **v43**

## Requested

At Cranberry Fest (day 1), Froggy could see each booth's stock but could not find where the app shows what is still in the truck.

## Why

v41 built the truck (`showLedger`, `truckCardHTML`), but the card only rendered inside the day screen, below the day tabs, at the very bottom of the show screen, under the scoreboard, calculators, P&L, break even, expenses, revenue and stock cards.

## Done

- **🚚 In the truck right now** card at the TOP of any running booth show (`truckTopCardHTML`), right under the show hours. Per size: In truck (big, gold, red if negative) and "N on booths", total units, the day it is as of (`ledgerNow`), **Count the truck**, and **Open <day> ›**. Not packed yet → says so and points to Transfer Stock.
- **Stock tab → At Shows**: a booth show's card now adds a **🚚 Truck** line and a **🎪 Booths** line under the show total.
- No data changes, no migration. Same numbers as the v41 day-screen truck card.

## Verified

`tests/truck-top-card.test.js` 16/16 (new). All other suites unchanged: `passed-not-doing` and `product-debt-invoices` fail the same 3 checks on unmodified v42. Rendered at 390px in Chromium, no page errors.

---

## Added the same day: stock value by booth

**Requested:** "What's the cost of goods and the total sell price of the stock that's at each booth. There should be a tally. Per booth the money breakdown and then all together."

- `stockValue(sh,di,units)`: units, retail at the show's own prices (`sh.prices`, so Cranberry's show-only prices), cost at the COGS in effect that day (`calcCOGSOn` + `showDayKey`), profit = retail − cost.
- **Each booth card** gets a Cost / Retail / Profit row for what is on that table right now (`boothOnHand`: morning + restock + moves − lost, or the evening count once counted).
- **💲 Stock value by booth** tally card on the day screen, right under "Who's in which booth today" and above the booth cards: one row per booth, All booths, 🚚 Truck, Whole show.
- Read-only. No data changes.

Check with Froggy's day-1 counts (each booth 24/40/72/114/174/42): 466 units and **$7,810.00 retail** per booth, **$23,430.00** across all three. Cost follows whatever COGS his device has on file.

`tests/truck-top-card.test.js` now 27/27.
