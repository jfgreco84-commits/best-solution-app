# v37 — per-booth stock, editable, and product that can move between booths

**Branch:** `claude/cranberry-fest-booth-calendar-s77yge` (restarted from `main` after #32 merged)
**Base:** `1410e8f` on `main` (the merged, deployed v36)
**App version:** `v36` → **`v37`**
**State:** awaiting review

---

## REQUESTED

> "It doesn't seem to be right. I need to be able to click on the booth and then
> edit the stock for that booth and also have an option to be able to transfer
> product between booths."

v36 gave each booth its own morning count, evening count and money drawer, but
there was no way to open a booth, see what it was holding, or move product from
one booth to another. v36's handoff listed per-booth stock under NOT DONE. That
was the wrong call, and this fixes it.

---

## COMPLETED

### Tap a booth, get the booth

`openBoothDetail(shId, dayIndex, boothId)` is a full screen for one booth on one
day, reachable from three places: the booth card header on the day screen, any
row of the Booth Tally on the show screen, and the day tabs inside the screen
itself. It shows a per-SKU table with every route stock takes:

```
SKU   Open  +Restock  +In  −Out  −Lost  End  Sold  On hand
```

plus the booth's headline number — **what is on that table right now** — in
units and at full price, and the booth's whole-show totals underneath. Every
button that changes those numbers is on the same screen: set opening stock, count
ending stock, restock / lost, money, and move product.

**On hand is honest about what it knows.** Once a booth has been counted at close,
on hand IS that count, full stop. While the booth is still open it is
opening + restock + moved in − moved out − lost, which does **not** subtract
today's sales because nobody knows them until the booth is counted. The screen
says which of the two you are looking at rather than presenting a guess as a fact.

It opens on a **planned** show too, which is where the booths get set up before
the doors open — Cranberry is planned right now, so that is the case that matters.

### Moving product across the aisle

Booth 2 runs out of C5 Small at noon and booth 1 has a case under the table. That
product moves. It was not sold, it was not lost, and the show did not gain or
lose a bottle by moving it.

The ledger is ONE list per day, `d.boothTransfers`, and each booth's in/out
totals are DERIVED from it. There is no second copy to drift, and undoing a
transfer is deleting its row.

The invariant that makes it safe:

> **Every transfer cancels itself at the show level.**

What leaves booth A arrives at booth B, so summed across the booths the in and
out totals are identical and the day's own `morning + restock − evening`
arithmetic is untouched. The show's gross, units sold, COGS, at-show stock and
end-of-show returns cannot move by a unit because product was carried across the
aisle. Only the per-booth figures change, which is the entire point: booth 2's
sales get credited to booth 2, not to whoever happened to pack the box.

`boothUnitsLeft` is the per-booth mirror of `dayUnitsLeft`, plus the aisle:
`opening + restock + moved in − moved out − ending`, then minus lost to get sold.
The day-level functions were **not** touched, because the transfers cancel in
their sums by construction.

Refusals: a booth cannot move to itself, an empty slip or a slip of zeroes is
refused, and a finalized day refuses both a move and an undo. Moving more than
the booth is expected to have asks for confirmation rather than blocking — a
booth that sold less than predicted legitimately has more on the table than the
app thinks, and a transfer that really happened is a fact the books must carry.

### Everywhere else it shows up

- **Day screen** — each booth card now leads with what it is holding and any
  aisle traffic, and carries a 🔄 Move button. A day-wide "product moved between
  booths today" card lists every move with an ✕ to reverse it.
- **Show screen** — the Booth Tally rows are tappable and report moved in / out.
- **CSV** — booth day rows gain Moved In / Moved Out columns, a Booth transfers
  section lists every slip with its note, and the whole-show tally carries the
  totals.

---

## VERIFIED

```
node tests/booth-splits-and-calendar.test.js     153/153   (was 111; +42 new)
node tests/booking-pipeline-filters.test.js       89/89
node tests/phase2b.test.js                      193/193
node tests/product-debt-invoices.test.js        109/109
node tests/replay-guard.test.js                 155/155
node tests/passed-not-doing.test.js             427/430
```

`passed-not-doing` fails the same 3 date-sensitive checks on unmodified `main`.
Not caused by this branch.

Section 11 pins both halves of the transfer contract at once: the per-booth
credit MUST change (A is credited with the 5 it sold, not the 25 it would have
sold had it kept the case) and the show's day total, at-show stock, gross, COGS
and unit count MUST NOT. Section 12 pins the stock editor, including that on hand
is arithmetic while open and the counted number once closed.

Rendered through the harness and read back: the booth screen carries the stock
table, all five action buttons, the move button and the whole-show totals; the
transfer modal renders; the tally rows are tappable.

---

## NOT DONE

- **Per-booth rep assignment and day pay.** Pay is still entered per rep per day
  for the whole show. Still the obvious next piece if who-worked-which-booth
  needs to be in the record.
