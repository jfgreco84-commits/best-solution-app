# v57: Payout Sheet (end-of-show settle-up)

**Ask:** Day 1 / Day 2 / Day 3 / Total pay per person, with the rep stats, so the owner can pay everyone and leave. The ask also called for a hard audit of the pay flow.

## What the audit found
- **Profit was overstated by $1,511.68.** Rep pay in the P&L comes from `day.repPay`. Only Friday had been typed in, and those figures were rounded (Cutty $297.50 vs the exact $296.63, TJ/Dave $262.50 vs $261.98). Saturday's $1,513.59 was never entered. Profit through Saturday is **$2,845.35**, not $4,357.03.
- The Reps & Workers card and the Commission card showed two different "pay" numbers.
- Isaiah was listed with "No day pay yet". He comes from the old default crew and never worked a booth.
- "Who rang it up" had no day columns.
- Commission is 35% of everything that came in, and that total includes the card sales tax. This was left as-is, per the stated rule; it is surfaced to the owner only.

## What v57 changes
- `sh.payFromCommission` is new. On such a show, `commissionSyncPay` rewrites `day.repPay` to the exact commission on every `saveS()` and on boot. The P&L, the rep pages, Reps & Workers and the payout sheet now always agree. Manual Day Pay entry is blocked on these shows with a toast.
- The migration `cranberry_payout_v57` turns the flag on for Cranberry 2026.
- `payoutSheetHTML` sits at the top of both the Teams and Money tabs. It has three parts:
  - A pay table: Person × Day 1/2/3 × Total, with extras such as Dave's $200 folded in and noted.
  - A **Pay them out** list with a **Paid ✓** button for each person. The button fills the worker extra's `paid` first, then logs the rest in `rep.payments` with `showId`.
  - Rep stats: sales credited per day (the base the 35% is figured on) and the booth worked that day.
- The commission card is now a collapsed "Commission math, booth by booth".
- "Who rang it up" now has per-day columns. The cash/card/apps split sits in a collapsed section.
- Reps & Workers hides reps who have no pay, no sales and no booth on any day.

## Real data (Sep 26 backup through v57)
Les $785.75 · Anthony $645.75 · Dave $443.11 + $200 = $643.11 · Cutty $641.21 · TJ $443.11. Total **$3,158.93**. Sunday fills in by itself once it is counted.

## Tests
`tests/payout-sheet.test.js` (21 checks). All other suites pass except `passed-not-doing` and `product-debt-invoices`, which also fail on main (they depend on the date).
