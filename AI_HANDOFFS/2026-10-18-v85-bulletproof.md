# v85 bulletproof: damaged data, full phone, crashes, bad numbers (Oct 18 2026)

| | |
|---|---|
| **Branch** | `claude/bulletproof-v85` |
| **App version** | v84 → **v85** |
| **Tests** | `node tests/bulletproof-v85.test.js` (13 checks) |

Froggy: "Make sure nothing can go wrong!"

## The worst bug found: damaged data opened as a BLANK board

- **What happened.** If anything went wrong in `loadS` (one `null` in the show list, a missing list, a migration throwing, storage refusing the write), the catch fell through to a fresh `INIT` board. The next save wrote that blank board over the real data.
- **How it was proven.** Ten damaged copies of the real Oct 17 board were loaded in the harness. "One empty slot in the show list" opened as 45 seed shows with −$4,902 profit, instead of the real 50 shows.

**Fix:**
- **`repairShape(d)` runs before any migration.** It drops empty entries, rebuilds missing lists and objects, and fills missing payment boxes.
- **The copy from before is kept** as `dd_bs_backup_prerepair_<ts>`, and a toast says what was fixed.
- **If an update still throws:** the data opens exactly as saved (repaired), a copy is kept (`loadfail`), cloud sync is held (`syncQuarantineSet`), and a toast says so.
- **If the saved text can't be parsed at all:** a copy is kept (`unreadable`) and the stand-in board is marked `_readOnlyBlank`. `saveS` refuses to write it over the real data.
- **Result:** all 10 damaged copies open with all 50 shows and every page draws.

## Other failure modes closed

- **Save on a full phone.** `_saveLocal()` tries, then trims old automatic copies (keeps the newest) and tries again. If it still fails, a red **"NOT SAVED: tap to download your data"** bar stays up until a save works. Before, it failed silently.
- **Daily automatic copy.** `dailyCopy()` makes the first save of each day keep a device copy (last 3 kept), so a bad day can be rolled back from Device Backups.
- **Startup crash.** Instead of a stack-trace dead screen, a recovery screen offers "Download my data (safe copy)" (checked: 50 shows) and "Try again". If Home fails to draw, it falls back to Shows.
- **Any surprise error** shows a short toast ("What was saved is safe. Try again"), at most once every 4s, instead of a button that silently does nothing.
- **Bad numbers:**
  - Counts, money, day expenses and day pay can never go negative.
  - A money total over 3x what sold (and $300+ over) asks "An extra zero?" before saving.

## Re-runs

- The whole suite matches main: only the existing passed-not-doing (5) and product-debt-invoices (3) failures remain.
- Sync-safety (122) and replay-guard (158) both pass.
- Real-board audit is unchanged at $8,335.99, the engines agree, and the P&L reconciles.
- In Chromium at phone size: a damaged board opens with 50 shows and the "Fixed on load" note, and a forced startup crash shows the recovery screen with a working download.
