# v72: 📅 Previous Years on every show

**Date:** 2026-10-10 · **App version:** v71 → **v72**

Froggy: "Add a section that shows what was done at that same exact show the previous year or years. Call that button Previous Years. Year by year. Do that for every show."

## What it does

Every show screen has a **📅 Previous Years** drop-down above the tabs (collapsed by default). Inside, one card per earlier year, newest first: gross, net, COGS, booth, other expenses, **bottles sold per size per day** with a day total and $ row, money collected by method, and the year's note. A show with no history still gets the button and says so.

## Data

- `SHOWS_2025_DETAIL` (index-aligned with `SHOWS_2025`): first-day date `sd`, per-size `sold`, `sales`, `pay` by method and `days[]`, parsed from `BEST_SOLUTION 2025.xlsx` (Google Drive). Every show's day columns add up to its total (tested). `sdApprox` marks the three the workbook dated only to the month (Wheaton Aug, Rustic Fox Holiday Oct, Kris Kringle Dec).
- Completed shows in the app are history too (`pastShowRecords`), so 2026 shows appear in 2027 with no new code. Passed shows never count.

## Matching

`showSeriesKey(name, location)`: lowercase, months/years/punctuation stripped, plus known renames (Mukwonago Maxwell = Maxwell Street Days, Baraboo Womens = Baraboo Christmas, Rustic Fox N. Aurora = Fox & Found North Aurora, St. Martins Fest = Fair). Sip & Sleigh, Kris Kringle and Rustic Fox split by town. A series that runs more than once a year only matches within **21 days** of the same date (`PY_WINDOW_DAYS`), so Rustic Fox June never shows September.

**Assumption to confirm with Froggy:** Fox & Found North Aurora is the same event as 2025's Rustic Fox N. Aurora (Aug 8). Remove the `fox and found` alias if not.

## Verified

`tests/previous-years.test.js` 37/37. All other suites unchanged vs `main` (passed-not-doing and product-debt-invoices fail the same checks on unmodified `main`). Rendered in Chromium at 390px, no page errors, no horizontal scroll.
