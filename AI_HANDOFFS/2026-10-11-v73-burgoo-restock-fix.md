# v73: Burgoo Fest 2026 restock repair

**Date:** 2026-10-11 · **App version:** v72 → **v73**

Froggy, Burgoo Day 2 morning: restocked 2oz and C5 Small, **33 each to booth 1 (F37), 24 each to booth 2 (Jamie's Outpost)**, entered it, "it doesn't look right, fix it." His live data is behind his login, so the fix is a one-time migration (`burgoo_restock_fix_v73`, `burgooRestockFix(d)`) that puts the day in the one correct shape and undoes only exact matches of the known mistakes:

1. **Restock day** = the latest day after day 1 that carries a 2oz/C5-S restock, else the latest really-worked day (hand-counted opening, money, or closed), else the latest with an opening. A pre-filled (`morningSeeded`) opening alone never picks a day.
2. That day's restock is set to exactly 33/33 (F37) and 24/24 (JO). Other sizes untouched.
3. An opening equal to last night's close (+ garage delivery) **+ exactly the restock** is put back to last night's close (double count).
4. The same 33/33 or 24/24 on an **earlier** day is removed there (it inflated that day's sales and commission).
5. If the booths then hold more than the show has, the gap came from the garage: booked garage → truck on the restock day (garage −, packed +, `day.truckIn` +, one `S.transfers` row per size).

Idempotent; guarded to an active Burgoo 2026 with exactly two booths. Every change is listed on the show's change log as "🔧 Restock repair (v73)" and in the audit log.

**Verified:** `tests/burgoo-restock-fix.test.js` 86/86 (right already, double count, opening-only, wrong day, other Saturday restock kept, garage, wrong split, idempotent, guards, load path, pre-filled third day). Other suites unchanged vs `main`. Loaded in Chromium with a Saturday-logged restock in localStorage: repaired on reload, no page errors.
