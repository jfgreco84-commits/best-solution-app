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
