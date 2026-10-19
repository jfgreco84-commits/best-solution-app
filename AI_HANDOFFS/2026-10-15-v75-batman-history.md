# v75: Borrowed from Batman history log

| | |
|---|---|
| **Date** | 2026-10-15 |
| **Branch** | `claude/batman-borrowed-transactions-guzwsr` |
| **App version** | v74 → **v75** |
| **Live data changed** | **No.** Nothing written to Supabase. The back-fill runs on Froggy's devices on next load. |

## What v75 adds

**Every Batman change is logged by date, size and quantity.** Before this, Borrowed from Batman kept only a running total. Now:

- **+ Borrowed More** and **− Returned to Him** have a **Date** (defaults to today) and an optional **Note**. Each save writes a log entry.
- **Set Exact Counts** logs the signed change it made.
- A **📜 History** list sits under the buttons, newest first: date, type, bottles, sizes, owed after, note. The top line shows totals borrowed in the log, returned, and owed now.
- **✕** on an app entry undoes it. Borrowed/Returned reverse the debt and the garage; Set Exact reverses the debt only. The entry is removed.
- **⬇ CSV** downloads the whole history for settling up.

Storage: `S.settings.batmanLog` (no new top-level key). Entry: `{id, ts, date, type, items:{sku:qty}, owed:{sku:count after}, note, src}`. `type` is `borrow | return | set | change | snapshot`; `src` is `app` (can be undone) or `backup` (history only).

## Back-fill (migration `batman_history_seed_v75`)

The history was rebuilt from Froggy's own backups and seeded once, log only (no count or garage moves):

| Date | Entry | 32oz | 16oz | 8oz | 2oz | C5-S | C5-L | Owed after |
|---|---|---|---|---|---|---|---|---|
| Jul 6 | Owed (Jul 14 email backup) | 64 | 81 | 186 | 240 | 0 | 201 | 772 |
| Jul 14 | Borrowed, ~2:33 to 2:46 PM (Jul 14 backup vs the cloud dump taken before the Batman merge) | +48 | | +72 | | +280 | | 1,172 |
| Aug 2 | Borrowed between Jul 14 and Aug 2 (Aug 10 rolling backup, saved Aug 2 7:42 PM) | | +60 | +48 | +80 | +140 | +42 | 1,542 |
| Aug 18 | Change between Aug 10 and Aug 18 4:06 PM; looks like a Set Exact | −112 | −141 | −306 | −320 | +338 | +161 | 1,162 |
| Sep 18 | Borrowed, from Batman's text "Giving you now" | +9 | +3 | +58 | +160 | | | |
| Sep 24 | Borrowed (app audit log) | | | +48 | +80 | | +34 | |
| Sep 30 | Other borrows Aug 26 to Sep 30, incl. the C5 (dates not saved) | +2 | +1 | +17 | +23 | +296 | +7 | 1,900 |

Sources: 147 state copies across 42 Drive files and 4 email backups. The Aug 18 value is unchanged in every copy through the Aug 26 exports, so the last undated window is Aug 26 to Sep 30.

If the device's tally differs from Sep 30, one more entry logs the net change since then. The migration waits until the device's Batman tally holds bottles (so a blank device before cloud sync does not seed).

**Verified:** `tests/batman-history.test.js` 32/32. Every other suite passes except the same 8 date-dependent failures already on `main` (`passed-not-doing` 5, `product-debt-invoices` 3). Rendered in Chromium at phone width with no page errors.
