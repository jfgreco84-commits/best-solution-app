# v87 Calendar tab is back (Oct 21 2026)

| | |
|---|---|
| **Branch** | `claude/page-cleanup-readability-p7rwii` |
| **App version** | v86 → **v87** |
| **Live data changed** | No. Navigation only. |

## Why

v79 folded Calendar into a toggle at the top of Shows (6 tabs). Froggy uses the
calendar constantly to see which weekends and days have shows, and asked for it
back as its own bottom tab.

## What changed

- Bottom nav: **📅 CAL** sits between SHOWS and REPS again (7 tabs).
- `go('calendar')` lights up CAL, not SHOWS. Supplies still lights up STOCK.
- The Shows list / Calendar toggle at the top of both pages stays, so either way works.
- `tests/simplify-v79.test.js` 3a/3c now expect the Calendar button and 7 tabs.

Do not fold Calendar back into Shows without asking the owner.
