# v105 Bridal Expo moved to Jan 24, Nov 11 2026

**What Froggy said:** the bridal show at The Ten Hotel on January 17 has been changed to January 24.

**What changed (v104 → v105):**
- `bridalExpoDateV105(d)` moves the **Bridal Expo — The Ten Hotel** from Sun 2027-01-17 to **Sun 2027-01-24**. Day dates follow (`resizeShowDays`), a `date moved` line goes in the show's log, and a "DATE MOVED" note is added after his notes.
- Booth money untouched: $178 paid, Square #001930.
- Shape driven, runs every load **before** the v77 Social Market seed. The seed (`SMC_V77`) now carries Jan 24 too, so a re-run seed finds the moved show and never adds a second one.
- Stamped `sh.v105`, so if Froggy changes the date by hand later it is never moved back. If a Ten Hotel Bridal Expo is already on Jan 24, nothing moves.
- Completed shows are never moved. A passed show still gets the new date (data only).

**Tests:** `node tests/bridal-expo-date-v105.test.js` (10 checks). `expense-audit.test.js` updated to the new date.
Pre-existing failures, same on `main` before this change: `gas-area-v93` 4f/4h (date dependent) and `product-debt-invoices` (3 checks).

**Live data changed:** no direct cloud write. Each device moves the show on its next load.
