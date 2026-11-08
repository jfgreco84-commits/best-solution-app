# v104 Fix Packed on a closed show (Nov 8 2026)

| | |
|---|---|
| **Branch** | `claude/small-sets-inventory-fix-e8bwan` |
| **App version** | v103 → **v104** |
| **Tests** | `node tests/fix-packed-v104.test.js` (32 checks; was fix-packed-v103) |
| **Live data changed** | Only by the guarded one-time update `rustic_fox_sets_v104` |

## REQUESTED

Froggy, Nov 8, screenshot: "it's still not fixed". The Rustic Fox Holiday Market (Nov 7) was already
**Completed** when v103 loaded. v103 only fixed running shows, so its update skipped the show (and set its
marker), and the ✏️ Fix Packed button didn't show on a closed show.

## WHAT CHANGED

- ✏️ Fix Packed works on **closed shows** too (button on the stock card of any packed show).
- A finalized day blocks the fix only when its opening count would have to move. Nov 7 opened at 32
  already, so only packed moves.
- New marker `rustic_fox_sets_v104` re-runs the same fix, running or closed, still only while SET packed reads 22:
  SET 22 → 32, garage SET −10 (capped). Sold 18 and returned 14 do not change, and the save-time audit
  (`auditSyncReturns`) does not move the garage again (test 5e).

## STILL OPEN

- Same as v103: if the 10 extra sets were built at home and never entered, fix garage 2oz / C5-S instead.
- Date-based failures on main, unrelated: `gas-area-v93` 4f, `product-debt-invoices` (3), `passed-not-doing` (6).
