# v74: Home inventory alert says what to fix, and stops nagging about settled shows

**Date:** 2026-10-12 · **App version:** v73 → **v74**

Froggy, from the Home screen: the red "Inventory mismatch needs review" card listed McHenry County Fair, Rustic Fox Carol Stream (Jun), Rustic Fox Carol Stream (Jul), St. Martins Fair and Wine and Harvest Fest with "opening/ending counts don't reconcile. Tap to fix." It said nothing about what was wrong and opened only the first show.

**Why those five:** every one closed before the Sep 23 garage recount (`settings.audit.baseline`). The recount already absorbed their count gaps (the v41 note names St. Martins and Wine & Harvest as where the 2oz/C5L gaps came from). The v41 audit skips those shows (`auditSkip`); the older Home card used `invStatus` alone and never learned that rule. Editing their counts now changes nothing real.

**What changed**

1. `invSettled(sh)`: completed before the baseline, by `completedAt`, or by end date when the show predates `completedAt`. No baseline = nothing settled.
2. `invAlertShows()` drops settled shows. Home card only appears for active or post-recount shows.
3. The card now says the exact problem per show (day, size, both numbers, "+N more") and opens `openInvFix()`, a modal listing every problem across every alerting show with its fix:
   - opening ≠ last night: **↩︎ Use last night's count** (`fixCarryFromPrev`) or **✓ Morning count is right** (logged override, no prompt)
   - ended above what was out: **± Log the restock** (`openAdjustModal`; booth shows open the show)
   - table holds more than the show has: **Open show**
   The modal refreshes after each fix and closes with "All inventory counts reconcile" when done.
4. On a settled show's Reconciliation panel the red banner is replaced by "🗂️ Settled by the garage recount on 2026-09-23 … Nothing to do here", and the panel no longer auto-opens. Day rows still show the old numbers.

**Verified:** `tests/inventory-alert.test.js` 15/15. Other suites unchanged vs `main` (`passed-not-doing` 5 and `product-debt-invoices` 3 fail identically on `main`; date-dependent fixtures). Home + modal + show page render in the harness without errors; show names are escaped.
