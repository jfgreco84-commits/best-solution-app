# v38 — bring more product from the garage to a show that is already running

**Branch:** `claude/transfer-stock-garage-shows-n4yvaj`
**Base:** `1850c0f` on `main` (the merged, deployed v37)
**App version:** `v37` → **`v38`**
**State:** awaiting review — not merged, not deployed

---

## REQUESTED

> "Right now I am on the show Wine and Harvest Fest and I need to take more
> product there tomorrow from my garage. If I hit transfer stock it only gives
> me options to pick from other shows. It doesn't give me an option to pick
> from my garage."

Correct. Until v38 there were exactly two ways product left the garage: **Pack
for Show**, which runs once when a show starts, and nothing else. The Transfer
Stock picker only ever listed other shows. The nearest workaround was to enter
the units as ± Restock on the day and then walk over to the Stock tab and knock
the same number off the garage by hand — two steps, easy to forget one, and
nothing tied them together.

---

## COMPLETED

### The garage is a source

Open **Transfer Stock** from the Stock tab or from the show page and **From**
now offers **🏠 Garage** whenever a show is running. Opened from a running
show, the modal is already set to *Garage → this show*, on the right day.

A garage delivery does three things at once, so no number has to be fixed by
hand afterwards:

1. **Garage count goes down** (`S.inventory`).
2. **The show's packed total goes up** (`sh.packedInventory`), because
   end-of-show returns read packed − sold − lost.
3. **It lands as +Restock on the day it is for**, and on the booth if the
   show has booths. That is exactly what Restock already meant in this app
   ("extra units you brought to the booth that day"), so sold is still
   opening + restock − ending and nothing downstream had to learn anything.

Which means **tomorrow's morning count stays what it always was: last night's
ending count, the default.** No reconciliation mismatch, no explain-the-
difference prompt, and the units sold out of the delivery are counted exactly
once. The modal says this in one line so they do not get counted into the
morning number by mistake.

The invariant: **garage + at-shows never changes by a unit** when product is
delivered. Only where it sits changes.

### Which day

The modal picks the day the delivery is for: today while today is still open,
otherwise the next day that has not been counted at close, otherwise the last
day. A dropdown lets you override it. Tonight, with day 1 counted at close,
that is tomorrow — the case that prompted this.

### Booth shows

If the receiving show has booths (Cranberry), the modal asks which booth gets
it. The units land on that booth's restock and the day is rolled up, so the
booth is credited with what it sells out of the delivery and the day total
carries it. Per-booth and day-level continuity checks both stay clean.

### Undo

Every delivery is one row in the transfer log on the Stock tab, marked
🏠 Garage → show, with the day it was for and the booth if any. Undo puts all
three numbers back: garage, packed, restock (floored at 0 in case the day's
restock was edited by hand since). A finalized day refuses both the delivery
and the undo.

### On hand knows about tomorrow

`showOnHand` now adds restock booked on a later, not-yet-counted day on top of
the last count, so the Stock tab's "Out At Shows" and "Everything" totals are
right the moment the delivery is saved instead of the next morning. It does NOT
add it on top of the packed fallback (a show with no counts at all), because
packed already carries every delivery — that would double count.

### Not changed

- **Show → show transfers are byte-for-byte what they were.** No day is
  written on either side and the garage never notices. Section 8 of the new
  suite pins it.
- **Show → garage mid-show is not offered.** Product goes home when the show
  closes (End Show returns everything), which is the path that already exists
  and reconciles. Sending product home mid-show would need a negative restock
  on the day to keep sold honest, and the adjust modal would silently drop a
  negative on re-save. Left out on purpose; say the word if it is wanted.
- **Pack for Show** is still how a planned show gets its stock. The garage is
  only offered as a source for a show that has started, and the modal says
  so if you try.

---

## VERIFIED

```
node tests/garage-transfers.test.js              110/110   (new)
node tests/booth-splits-and-calendar.test.js     153/153
node tests/booking-pipeline-filters.test.js       89/89
node tests/phase2b.test.js                      193/193
node tests/product-debt-invoices.test.js        109/109
node tests/replay-guard.test.js                 155/155
node tests/passed-not-doing.test.js             427/430
```

`passed-not-doing` fails the same 3 date-sensitive checks on unmodified
`main`. Not caused by this branch.

Rendered in headless Chromium at phone width with a two-day running show
seeded: the modal opens as Garage → Wine and Harvest Fest with tomorrow
preselected, and saving 50 C5S through the real DOM moves garage 290 → 240,
packed 100 → 150, tomorrow's restock 0 → 50, on hand 60 → 110, one ledger row,
toast "🏠 50 C5-S from the garage → Wine and Harvest Fest". No page errors.

**Live data changed:** No. No real Supabase read or write was made.

---

## HOW TO USE IT TOMORROW

1. Open **Wine and Harvest Fest** → tap **🔄 Transfer Stock · bring more from
   the garage**. (Or Stock tab → same button.)
2. From is already **🏠 Garage**, To is already the show, day is already
   tomorrow. Pick the product, type the quantity, tap **Bring it**. Repeat per
   product.
3. In the morning, do the morning count the normal way — accept the default
   (last night's count). Do NOT add the new cases into it; the app already has
   them as +Restock.
4. Count at close as usual. Sold = opening + delivered − ending.

---

## NOT DONE

- Show → garage mid-show (see above).
- A delivery button on the day screen itself. The show page button and the
  Stock tab button are the two entry points.
