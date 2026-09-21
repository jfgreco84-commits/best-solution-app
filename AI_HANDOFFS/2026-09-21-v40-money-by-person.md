# v40 — money by person: Isaiah's drawer counted on its own, rolled into the total

**Branch:** `claude/transfer-stock-garage-shows-n4yvaj` (restarted from `main` after #36 merged)
**Base:** `b502a10` on `main` (the merged, deployed v39)
**App version:** `v39` → **`v40`**
**State:** awaiting review

---

## REQUESTED

> "Isaiah worked with me. I need a place to input his cash, credit card, and
> Venmo totals, and have the app roll his numbers into the total while still
> showing them separately. Can you redesign the input or suggest a workaround?"

There was no workaround worth giving. The money count was one drawer per day
(or per booth), so a second person's cash either got folded into Froggy's
number and lost, or tracked outside the app entirely.

---

## COMPLETED

### The rule

The money count is now splittable by person, and the rule is the booth rule
one level down:

> **A SELLER IS AN INPUT. THE DRAWER IS THE TOTAL.**

Per-person entries live in `<drawer>.sellerPayments[repId]`, where the drawer
is the **day** on an ordinary show and the **booth entry** on a show that runs
booths. Whenever the split is non-empty the drawer's own `payments` are
**rebuilt from the sum**, so every figure downstream — the day total, the
cash-vs-product check, collected revenue, the P&L, the closeout wizard and
every export — keeps reading `payments` exactly the way it always did and gets
the right number for free. Nothing downstream had to learn what a seller is.

On a booth show it composes: **seller → booth → day**, because `rollupDay`
re-rolls each booth from its own sellers before summing the booths.

### The input

The Money Count modal gets one button: **👥 Split this drawer by person**.

- Tapping it opens a card per person, each with its own payment rows and a
  live subtotal, above the drawer's live grand total.
- The owner is there by default; **+ Add person** reaches the rest of the
  active roster. Isaiah is already on it.
- Money already counted flat is **carried into** the split (it seeds the first
  person) rather than dropped, and coming back out of the split the flat count
  becomes the sum. The two can never disagree.
- Seven methods per person is a wall of boxes on a phone, so the split shows
  **Cash, Square, Debit, Venmo** and folds Zelle / Cash App / PayPal behind a
  link, unfolding automatically once one of them carries money. A folded row
  keeps its value, because the save reads state, not inputs. The flat count
  still offers all seven, unchanged.
- Anyone credited with money is **added to the show's crew**, so their day pay
  is enterable. The toast says so.

Refusals: a finalized day refuses the save; an all-zero row is dropped rather
than parked in the books at $0; an all-zero split is no split; the last row
cannot be removed (that is the "one total" button's job).

`saveMoney` now also accepts an explicit `(shId, di, boothId)` target. Handed
one that is not what the modal holds, it reads a flat count off the inputs, so
a save can never land on a day the caller did not name.

### Where it shows

- **Show screen — 👥 Who rang it up.** Person · Cash · Card · Apps · Total,
  with a totals row. Card = Square + Debit. Apps = Venmo, Zelle, Cash App,
  PayPal.
- **Day screen** — the Money column lists each person under the total.
- **Booth screen** — a "Drawer by person" line.
- **CSV** — a per-day-per-person section and a whole-show roll-up.

### Nothing changes for a day that was never split

The modal opens flat, shows all seven methods, and saves exactly as before.
No migration, no new required field, no risk to existing data.

---

## VERIFIED

```
node tests/money-by-person.test.js               90/90    (new)
node tests/garage-transfers.test.js             167/167
node tests/booth-splits-and-calendar.test.js    153/153
node tests/booking-pipeline-filters.test.js      89/89
node tests/phase2b.test.js                      193/193
node tests/product-debt-invoices.test.js        109/109
node tests/replay-guard.test.js                 155/155
node tests/passed-not-doing.test.js             427/430
```

`passed-not-doing` fails the same 3 date-sensitive checks on unmodified
`main` — confirmed by stashing this branch and re-running. Not from here.

Section 2 pins that the drawer total, collected revenue, the P&L gross and the
cash check all read the grand total while each person stays readable alone.
Section 4 pins the booth composition, including that a second rollup changes
nothing and that editing one person re-rolls both levels. Section 6 pins that
the split and the total can never disagree. Section 9 pins the explicit
target. Section 10 pins the folded methods.

Rendered in headless Chromium at phone width and driven through the real DOM:
split Froggy 380 cash / 150 Square against Isaiah 120 / 50 / 45 Venmo, live
total $745.00, saved day total 745 (cash 500, Square 200, Venmo 45), Isaiah
215 and Froggy 530 on their own, collected revenue 745, Isaiah added to the
crew, no page errors. The whole modal — both people, the picker, the total and
the save button — fits one phone screen.

**Live data changed:** No.

---

## NOT DONE

- Per-person **units sold**. This is money only. Who rang up which bottle is a
  bigger change and nobody has asked for it.
- Splitting a booth drawer and the day drawer at the same time on the same
  show. A booth show splits per booth, which is the level the money is counted
  at anyway.
