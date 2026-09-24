# v42: Cranberry prices, team scoreboard, Batman bottles back in the garage

**Date:** 2026-09-24 · **Base:** `76aba19` (v41) · **App version:** v41 → **v42**

## Requested

- Raise prices for Cranberry Fest ONLY: 32oz $30, 16oz $25, 8oz $20, 2oz $12.50, C5 Small $12.50, C5 Large $25.
- A scoreboard of every team at the show: what they sold by payment method, what they were paid that day, and a running 3-day total. Teams: Froggy + Cutty, Les + Anthony, TJ + Dave. A spot to mark which booth each team was at.
- Froggy entered 34 C5L, 80 2oz, 48 8oz under Borrowed from Batman and expected them in the garage.

## Done

- **Show-only prices.** Migration `cranberry_prices_v42` writes `CRANBERRY_PRICES_2026` into the 2026 Cranberry show's `sh.prices` snapshot. App-wide `S.prices` and every other show are untouched. Everything that values Cranberry (potential revenue, cash check, booth tally, pre-show calculator) already reads `sh.prices`. New "💲 Prices at this show only" card on any show whose prices differ from normal, with an Edit modal (`openShowPrices`).
- **Team scoreboard.** `sh.teams=[{id,name,repIds}]`, seeded by `cranberry_teams_v42` (adds Les as `rep_les` if missing). A team's booth on a day IS that day's booth crew (`d.boothCrew`), so the booth picker and "Who's in which booth" are the same data. Team money = its booth's drawer (`boothCounts[b].payments`); unmarked falls back to the team's `sellerPayments`. Pay = `day.repPay`, tap a name to open Day Pay. Ranked with medals. Shown at the top of the show screen.
- **Batman regression fixed.** Commit `22f24f0` (Jul 14) made + Borrowed More / − Returned move `S.inventory`; the Jul 17 to 19 "Deploy from master" commits overwrote it with an older copy. Restored. Set Exact still edits only the debt. One-time `batman_to_garage_20260924` adds C5L +34, 2oz +80, 8oz +48 to the garage, only on a device whose Batman tally holds at least those, and marks itself done only when it lands.

## Verified

`tests/cranberry-scoreboard.test.js` 29/29. All other suites pass; `passed-not-doing` has the same 3 failures as unmodified `main`. Rendered at 375px in Chromium.
