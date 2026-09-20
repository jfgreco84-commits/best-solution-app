# v39 — every size in one tap, and a delivery is part of the opening count

**Branch:** `claude/transfer-stock-garage-shows-n4yvaj` (restarted from `main` after #35 merged)
**Base:** `652b5fe` on `main` (the merged, deployed v38)
**App version:** `v38` → **`v39`**
**State:** awaiting review — not merged, not deployed

---

## REQUESTED

Three things, from the show floor with v38 running:

1. "It only gives me an option to add one size at a time. Today I am bringing
   8 ounce, C5 large and 2 ounce. Why can't I add all three boxes at once?"
2. "When I bring it from the garage to the show, what does that do to the
   numbers? I think it should add to last night's count so it doesn't throw
   the count off."
3. "It should add to the overall inventory of the show where it's clearly
   labeled, in the show stock, how much was brought there."

---

## COMPLETED

### 1. Every size in one tap

The Transfer Stock modal now shows a row per size, the way Pack for Show does,
with what the garage (or the sending show) holds beside each one. Fill in
every size you are bringing and tap **Bring it all** once. One tap makes one
batch: it shows as one line in the Stock tab log, on the day screen and on the
show screen, and one ↩ undoes the whole tap. Show → show transfers got the same
grid.

### 2. A delivery is part of the opening count

v38 landed a delivery as +Restock on the day. That kept sold right, but the
morning count on the screen stayed at last night's number while the table had
more on it, and anyone who counted the table would have been flagged.

v39 changes where it lands. The rule:

> **What comes from the garage for a day is part of that day's opening.**

- It is written to `day.garageIn` (per booth on a booth show, rolled up to the
  day by `rollupDay`).
- If the day's morning count is already in (the evening save pre-fills the next
  morning from tonight's ending, so on day 2+ it usually is), the morning count
  goes **up by the delivery on the spot**.
- If it is not in yet, the morning count modal defaults to **last night's
  ending + brought**, and says so on each row ("Last night 60 + 🏠 50 brought =
  110"). Tonight's evening save also pre-fills tomorrow that way.
- The reconciliation ladder now expects **last night + brought**, so the
  number on the table and the number on the screen agree with no flag. A
  morning that ignores the delivery IS flagged, and the flag says what was
  expected and why. "Reset to last night" resets to last night + brought.
- Sold is still opening + restock − ending. Nothing is counted twice, and
  **Restock is left for what it always meant**: a manual adjustment.
- Mid-day deliveries (morning already counted) raise that morning on the spot,
  which is the same arithmetic.

Reopening the morning count keeps the number that is in, instead of silently
dropping back to last night — that would have lost the delivery.

The v38 invariant still holds: garage down, packed up, the day up, all by the
same amount, so **garage + at-shows never changes by a unit**. Undo puts all
three back.

### Migration of this morning's three deliveries

Justin brought 54 C5 Large, 48 8oz and 8 2oz to Wine and Harvest Fest through
v38 this morning, which landed them as +Restock on today. On first load v39
moves every v38 garage row onto the opening count: restock comes down by what
it holds, `garageIn` goes up, and the morning count is raised by whatever part
of the delivery it does not already contain, measured against last night's
ending. So a morning that was recounted WITH the new product on the table is
not raised a second time. Gated by `_applied.garage_in_v39`. Rows are stamped
`landed:'opening'` so it never runs on them twice; a stamped-`restock` row (none
exist, but the undo handles it) is reversed from restock.

### 3. Where it shows up

- **Show screen — 📦 Show stock card.** One row per size: Packed at start,
  🏠 Brought, Total sent, Sold, On hand (or Returned once the show closes),
  with a totals row and a line per delivery tap underneath. Packed at start is
  the packed total minus what was brought, so the two columns add up to what
  was sent.
- **Day screen — 🏠 Brought from the garage card.** Every tap for that day
  with an ✕ to undo it, plus a **Bring more from the garage** button, so the
  modal is one tap from the day you are on. The Morning column says
  "incl. 🏠 +N from garage".
- **Booth screen** says what was brought to that booth today, already in its
  opening.
- **Reconciliation ladder** prints "Opening 110 (incl. 🏠 50 from garage)".

---

## VERIFIED

```
node tests/garage-transfers.test.js              167/167   (was 110; rewritten for v39)
node tests/booth-splits-and-calendar.test.js     153/153
node tests/booking-pipeline-filters.test.js       89/89
node tests/phase2b.test.js                      193/193
node tests/product-debt-invoices.test.js        109/109
node tests/replay-guard.test.js                 155/155
node tests/passed-not-doing.test.js             427/430
```

`passed-not-doing` fails the same 3 date-sensitive checks on unmodified
`main`. Not caused by this branch.

Section 3 pins all four orders of events: delivery booked before the morning
count (modal default = last night + brought), delivery booked before tonight's
evening save (the pre-fill carries it), mid-day delivery (opening raised on the
spot), and a morning that ignores the delivery (flagged, with the expectation
named, and reset puts it right). Section 5 does the same on a booth. Section 9
pins the migration including the recounted-morning case and the booth case.

Rendered in headless Chromium at phone width with a two-day running show whose
day 2 morning was pre-filled from day 1's ending, and brought 54 C5L, 48 8oz
and 8 2oz through the real DOM in one tap: garage 68→14 / 68→20 / 85→77,
packed 30→84 / 20→68 / 40→48, today's opening 20→74 / 12→60 / 30→38, brought
{54,48,8}, restock untouched, zero continuity issues, one batch, toast
"🏠 48 8oz · 8 2oz · 54 C5-L → Wine and Harvest Fest". No page errors.

**Live data changed:** No. No real Supabase read or write was made.

---

## WHAT JUSTIN SEES AFTER THIS DEPLOYS

Reload the app. Today's morning count at Wine and Harvest Fest goes up by the
three deliveries already entered this morning (54 C5L, 48 8oz, 8 2oz), restock
drops to zero, and the reconciliation stays green. The show screen shows the
stock card with those three under 🏠 Brought. Nothing to redo.

---

## NOT DONE

- Show → garage mid-show is still not offered. End Show returns everything.
