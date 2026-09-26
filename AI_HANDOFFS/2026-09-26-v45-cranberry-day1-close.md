# v45: Cranberry day 1 closed for Froggy

**Date:** 2026-09-26 · **Base:** `11e55ca` (v44) · **App version:** v44 → **v45**

## Requested

"Please make these fixes for me." Froggy's Sep 25 end-of-day hand counts:
truck 8oz 72, C5S 140, C5L 124 (rest 0); Booth 1 22/35/59/72/132/23; Booth 2 21/37/76/9/130/36; Booth 3 16/36/49/90/148/16.

## Done

One-time update `cranberry_day1_close_v45` in `applyOneTimeUpdates` (runs on his device, local or cloud-adopted state):
- Finds the active 2026 Cranberry show starting 2026-09-25 with Booth 1/2/3 all opened on day 1, day not finalized. Otherwise does nothing and retries next load.
- Any booth that ends above what it had (morning + restock + moves − lost) gets the gap logged as a 🚚 restock off the truck (with the Sep 25 morning counts: Booth 2 8oz +4).
- Sets each booth's day 1 ending count, records the truck count, moves `packedInventory` by counted − expected truck. Garage untouched.
- Logged on the show and in the audit log (`packFix`).

## Verified

`tests/cranberry-day1-close.test.js` 14/14: endings land, packed becomes the real boxes, truck = hand count, day 1 sold 13/12/36/171/112/51, no truck / negative / over-table findings, whole show 59/108/256/171/550/199, second load no-op, locked day and non-Cranberry untouched. Other suites unchanged vs v44.

## Still his to do

Money for each booth for day 1 (the app cannot know it). Day 2 morning counts.
