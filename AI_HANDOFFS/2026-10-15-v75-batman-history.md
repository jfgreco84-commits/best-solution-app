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

| Date | Entry | 32oz | 16oz | 8oz | 2oz | C5-S | C5-L |
|---|---|---|---|---|---|---|---|
| Jul 6 | Owed (Jul 14 email backup) | 64 | 81 | 186 | 240 | 0 | 201 |
| Aug 18 | Net change (Aug 26 Drive backup holds Aug 18 state) | −64 | −81 | −186 | −240 | +758 | +203 |
| Sep 24 | Borrowed (app audit log) | | | +48 | +80 | | +34 |
| Sep 30 | Other borrows Aug 18 to Sep 30 (dates not saved) | +11 | +4 | +75 | +183 | +296 | +7 |
| Sep 30 | Owed (Sep 30 email backup) | 11 | 4 | 123 | 263 | 1054 | 445 |

If the device's tally differs from Sep 30, one more entry logs the net change since then. The migration waits until the device's Batman tally holds bottles (so a blank device before cloud sync does not seed).

**Verified:** `tests/batman-history.test.js` 25/25. Every other suite passes except the same 8 date-dependent failures already on `main` (`passed-not-doing` 5, `product-debt-invoices` 3). Rendered in Chromium at phone width with no page errors.
