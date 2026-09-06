# v36 — per-booth counts at Cranberry Fest, and a calendar you can tap

**Branch:** `claude/cranberry-fest-booth-calendar-s77yge`
**Base:** `cb677b9` on `main` (carries the merged, deployed v35)
**App version:** `v35` → `v36`
**State:** awaiting review — not merged, not deployed

---

## REQUESTED

Two changes.

**1. Cranberry Fest runs three booths.** Other people work two of them, so
each booth gets counted on its own in the morning, counted again at close, and
cashed out on its own. Three sets of numbers written down twice a day, plus a
grand total that everything adds into. The product still comes off master
stock to the show, not to a booth — "it wouldn't have to be three booths on
that part of it".

**2. The calendar.** A red conflict day should open every show on it, and
picking one should go into that show. Any other day should jump straight to
its show. Booth rent did not look like it was in the show's numbers, and the
break-even should be visible in the main reading, not only on planned shows.

---

## COMPLETED

### Multi-booth shows

The rule the whole feature is built on:

> **A booth is an input. The day is the total.**

Per-booth entries live in `day.boothCounts[boothId]`, and the day's own
`morningCount` / `eveningCount` / `restock` / `lost` / `payments` are **rebuilt
from the sum of the booths** every time a booth is saved (`rollupDay`). Nothing
downstream had to learn what a booth is. COGS, revenue, the cash check, the
reconciliation ladder, the P&L, the closeout wizard, the CSV and the printed
report all keep reading the day exactly as before, and what they read is now
the grand total. One code path, one set of numbers, no second ledger to drift.

**Shape**

```
sh.booths      [{id,name}]   empty or absent = ordinary single-booth show
d.boothCounts  {boothId:{morningCount,eveningCount,restock,lost,payments}}
```

**The half-closed day.** The evening rollup is deliberately all-or-nothing. If
booth 1 has closed and booths 2 and 3 have not, summing what exists would read
as "opened with 300, ended with 90" — a 210-unit sale that never happened and
a COGS charge to match. So the day's `eveningCount` stays `null` until every
booth that opened has also closed, and the screen names the booths still
owing a count. The morning rollup is additive as booths come in, because a
booth not yet counted is simply not open yet.

**Stock is not split.** Product leaves the garage once, to the SHOW.
`showOnHand`, `atShowsInv`, the pack modal, stock transfers and
`endShowReturns` are untouched and still work show-level. Booths divide the
counting, not the pull. Pinned by test section 5.

**Turning booths on moves nothing.** A show that already has day data hands
that data to booth 1 (`boothSeedFromDays`), so the rollup reproduces the
identical totals a second later — gross, COGS, units and profit all unchanged
(test section 4). A booth that carries real numbers **cannot** be deleted by
the manager; it names the booth and refuses. An empty one drops cleanly.

**On screen**

- **Day screen** — one card per booth: its own morning column, evening column
  and drawer, its own cash-vs-product check, its own restock/lost, and its own
  carry check against that booth's ending last night. Underneath, the familiar
  3-column block, relabelled **Grand total** with its buttons replaced by
  "= sum of booths". There is exactly one way for those numbers to change and
  it is by counting a booth.
- **Show screen** — a **Booth Tally** card: every booth's units, money, product
  cost and full-price value side by side, then the **GRAND TOTAL**.
- **Closeout wizard** — steps 1 and 2 become per-booth buttons, and the day
  cannot be locked while a booth that opened is still uncounted.
- **Edit Show** — a booth button (1 / 2 / 3 / 4, or named by hand).
- **CSV and printed report** — a per-booth day sheet, a per-booth whole-show
  tally, and the grand total.

**Cranberry Fest 2026** gets Booth 1 / Booth 2 / Booth 3 through the one-time
update `cranberry_three_booths_2026`. One show, one `$450` booth fee, one
calendar entry, one stock pull. Nothing else on the board gained a booth.

### The calendar

Every coloured day is now a door. One show opens that show **on the day tab
you tapped** — tap day 3 of a 3-day show and you land on day 3, not day 1. Two
or more shows open a picker naming each one with its status, location, crew,
booth cost and break-even (or gross and profit once it is running), and picking
one goes into it, again on the tapped date's own day. The grid and the picker
read the same filter, so a red day always has a list behind it and a passed
show is on neither.

### Booth rent, and where break-even lives

Booth rent **was** already inside both `calcShow().expenses` and
`calcBreakEven()`. The problem was that neither number showed its work, so
there was no way to check. Both now do:

- `calcBreakEven()` returns `fixedCosts` and a named `parts` breakdown —
  booth rent, gas, lodging, other show expenses, candy + paper, crew pay.
- A shared **break-even panel** prints that breakdown under the figure and
  appears on **every** show card (planned, active, completed) and on the show
  screen. Once money is coming in it also says *"past break even by $X"* or
  *"$X still to collect"*.
- A new **expense receipt** on the show screen itemises every dollar inside the
  Expenses figure, booth rent first, and totals to the same number the P&L uses.
- Break-even and its parts are in the CSV and the printed report too.

Test 8f/8g change the booth fee and assert break-even moves with it — the check
that would have caught booth rent quietly going missing.

---

## VERIFIED

```
node tests/booth-splits-and-calendar.test.js     111/111
node tests/booking-pipeline-filters.test.js       89/89
node tests/phase2b.test.js                      193/193
node tests/product-debt-invoices.test.js        109/109
node tests/replay-guard.test.js                 155/155
node tests/passed-not-doing.test.js             427/430
```

`passed-not-doing` fails the same 3 checks on unmodified `main` (`git stash`,
run, `git stash pop` — identical result). Those three are date-sensitive
fixtures and are **not** caused by this branch.

Screens were rendered through the harness and read back: the show screen
carries the Booth Tally, the grand total, the break-even panel with its
booth-rent line and the expense receipt; the day screen carries three booth
cards and the auto-summed grand total; the closeout wizard names Booth 2 and
Booth 3 as still open and refuses to lock; the calendar routes every day
through `openCalDay`.

---

## NOT DONE

- **Per-booth rep assignment and per-booth day pay.** Pay is still entered per
  rep per day for the whole show. If who-worked-which-booth needs to be part of
  the record, that is the next piece.
- **Per-booth stock allocation.** Deliberate — stock stays show-level, as
  requested.
