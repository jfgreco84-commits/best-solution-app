# v44: fix the show from a truck count

**Date:** 2026-09-26 · **Base:** `0a8a872` (v43) · **App version:** v43 → **v44**

## Requested

Cranberry: boxes miscounted at packing (8oz boxes read as 2oz, extra C5 Large). Froggy hand-counted everything: truck C5L 124, C5S 140, 8oz 72; Booth 1 22/35/59/72/132/23, Booth 2 21/37/76/9/130/36, Booth 3 16/36/49/90/148/16. At the show: 59 / 108 / 256 / 171 / 550 / 199.

## Done

- `fixPackedFromTruckCount(shId,di)`: after 🚚 Count the truck, moves `sh.packedInventory` by exactly the counted-minus-expected difference, so the app's truck equals the count. Garage untouched (the product already left it, the number written for it was wrong). Logged in `sh.invLog`, `settings.audit.log` (type `packFix`) and `sh.packFixes`.
- **✅ My truck count is right. Fix the show** button on the day-screen truck card and the top truck card whenever a truck count is off. Confirm modal lists each size (app said / you counted / diff) and warns to count every booth and enter truck→booth moves as 🚚 Restock first, or it hides a sale.

## Verified

`tests/fix-packed-from-truck.test.js` 17/17 with Froggy's exact counts. All other suites unchanged; `passed-not-doing` and `product-debt-invoices` fail the same checks on unmodified v43 (date-sensitive / v42 migrations). Rendered in Chromium, no page errors.

## Note

The Sep 24 Batman migration added C5L +34, 2oz +80, 8oz +48 to the garage. Froggy's gaps (2oz −160 = 2×80, 8oz +48) look related. Worth checking the garage after Cranberry closes.
