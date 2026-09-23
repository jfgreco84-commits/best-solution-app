# v41 — the truck, and an app that audits itself

**Branch:** `claude/garage-inventory-discrepancies-0swvjo`
**Base:** `2f5174f` on `main` (the merged, deployed v40)
**App version:** `v40` → **`v41`**
**State:** awaiting review. Needed before Cranberry Fest (leaves Sep 24, show Sep 25 to 27).

---

## WHY

The Sep 23 garage count did not match the app: 2oz 40 short, C5 Large 40
short, C5 Small 120 over (Justin found that one himself), 8oz 10 over.
Traced from the Sep 22 backup:

| Gap | Where | What happened |
|---|---|---|
| C5L −40 | St. Martins Fair, Sep 6 | Packed 42. Day 1 morning raised 42→84 and close 20→62 after the fact. The app never took the extra 42 from the garage, then returned 48 instead of 6 at close. +42 on paper (net +41 after the Rustic Fox recount). |
| 2oz −40 | Wine & Harvest Fest, Sep 19 | Packed 79. Day 1 morning raised 79→116 four minutes after Fox & Found (Isaiah, $1, zero sold) closed and returned its 40 2oz. Counted twice. +37 on paper. |
| 8oz +10 | Rustic Fox Carol Stream (Sep) | Anthony's recount on Sep 11 raised the close 23→32 after the show closed on Sep 10. A recount after close never went back to the garage. |

Nothing in v40 flagged either mistake.

## REQUESTED

> "Set up something that flags when the count is not matching up. I need it
> to audit itself every time something moves." Cranberry: take all the
> product, most of it stays in the truck, each booth gets its own amount
> each day, booths can pull more from the truck, truck and booths counted
> separately. Two reps per booth. Add Cutty, who works Froggy's booth.

---

## COMPLETED

### The rule

> **Everything at a show is either on a table or in the truck.**

`showLedger(sh)` walks a show day by day: start (packed, minus deliveries
still to come, minus what left on earlier days, plus today's delivery), table
(morning + restock), **truck = start − table**, left, end. The truck can never
be negative. A table holding more than the show has is exactly the St. Martins
and Wine & Harvest mistake.

### Self-audit on every save

`auditAll()` runs inside `renderCur`, so after every save and on load:

- **overTable** (red): a table or the booths hold more than the show has.
- **noClose / noMorning** (red): a day that opened and was never counted at
  close (past days only; today is still open), or a close with no morning.
- **moneyNoCount** (red): money collected on a day with no count.
- **negSold** (red): ended with more than it opened.
- **carry** (gold, single-table shows): unresolved opening mismatch.
- **truckCount** (gold): the hand count of the truck is off.
- **returnDrift** (red): a closed show's counts no longer match what it sent home.
- **staleActive** (gold): a show left open after its last day.
- **garageNeg** (red): the garage below zero.

Shown as a **⚠️ N badge** beside the sync dot and a **red bar under the
header** ("See all ›" opens the Inventory Audit screen with an Open it button
per finding). Shows closed before `settings.audit.baseline` (the recount) are
settled history and not re-checked.

### Close Show is gated, and follows later fixes

The Close Show modal lists every red finding for that show ("Fix these before
you close") and the button turns into **⚠️ Close anyway**. A clean show says
"Audit clean". Closing stores `sh.returned`. If a count is changed after close
(the Anthony case), `saveS` moves the garage by the difference, logs it on the
show and in the audit log, and toasts it. Only shows closed from v41 on carry
`returned`, so nothing historical moves.

### The truck (booth shows)

- **Pack for Show** on a booth show no longer writes a day-1 morning count:
  everything starts in the truck.
- A booth opening above last night is a **pull from the truck**, not a
  mismatch: the day-level and booth-level carry checks give way to the truck
  check on booth shows. The booth card says "🚚 C5-S +30 off the truck".
- **± Restock at a booth** = brought over from the truck, available as soon
  as the booth is open (not only after close).
- **🚚 Truck card** on the day screen: At show / On booths / In truck per
  size, plus **Count the truck** (`d.truckCount`) compared against what the
  app expects.
- **Garage → show delivery** on a booth show defaults to **🚚 Truck**
  (`d.truckIn`, rolled into the day's `garageIn`). Undo reverses it.
- **Stock tab "Out at shows"** includes the truck for booth shows.
- The booth morning count modal shows what is available for that booth.

### Booth crews

The ✏️ Booths manager has a rep toggle row under each booth
(`sh.booths[i].repIds`, kept across renames). The crew shows on the booth
card and is offered first in that booth's money split. Crew members join the
show's rep list.

### Crews rotate day by day

At Cranberry the two people in each booth move to a different booth each day.
Each day carries its own assignment (`d.boothCrew[boothId]`); a day with none
falls back to the booth's starting crew from the ✏️ Booths manager. The day
screen has **👥 Who's in which booth today**: every booth on one screen, tap a
name to place it, and a person can only be on one booth a day (placing them
takes them off the other). **🔄 Rotate from yesterday** moves Booth 1's crew
to Booth 2, 2 to 3, 3 to 1. The booth card and that booth's money split use
that day's crew.

### One-time data updates

- `garage_recount_20260923`: sets the garage to the physical count
  (77 / 134 / 259 / 276 / 859 / 224) **only if** it still reads exactly the
  Sep 22 numbers (78 / 136 / 249 / 316 / 739 / 264). Logged in the audit log.
- `audit_baseline_v41`: the audit starts clean today.
- `cutty_cranberry_v41`: Cutty active on the roster; Froggy + Cutty on
  Cranberry Booth 1 if Booth 1 has no crew yet.

Audit state lives in `settings.audit` (`baseline`, `log`). No new top-level
state key.

---

## VERIFIED

```
node tests/truck-and-audit.test.js               82/82   (new)
node tests/garage-transfers.test.js             167/167  (5k updated: booth show now counts the truck, 90 → 100)
node tests/booth-splits-and-calendar.test.js    153/153
node tests/money-by-person.test.js               90/90
node tests/booking-pipeline-filters.test.js      89/89
node tests/phase2b.test.js                      193/193
node tests/product-debt-invoices.test.js        109/109
node tests/replay-guard.test.js                 155/155
node tests/passed-not-doing.test.js             same date-sensitive failures as unmodified main
```

The Sep 22 backup booted through v41 (locally, not committed): garage lands
on the physical count, zero audit findings, Cutty on Booth 1. Driven in
headless Chromium at 390px: Take All into Cranberry, three booths opened,
truck card correct (C5-S 859 at show, 180 on booths, 679 in truck), a bad
booth count (900 C5-S) turns the truck red, the badge to ⚠️ 1 and the bar on,
and the audit screen names it. No page errors.

**Live data changed:** No Supabase read or write was made. The recount
migration runs on Justin's device on first load of v41.

---

## CRANBERRY CHECKLIST

1. Open the app. Header shows 🛡️ (no bar). Stock tab reads 77 / 134 / 259 / 276 / 859 / 224.
2. Each morning: day screen → 👥 Who's in which booth today (or 🔄 Rotate from yesterday).
3. 🎒 Start Show / Pack → **Take All** → Start Show. Everything is in the truck.
4. Each morning: count each booth's table. The truck card updates itself.
5. Booth runs low: 🚚 Restock from truck at that booth.
6. Each night: close every booth, count the money by person, optionally count the truck.
7. If the red bar shows up, tap it and fix it before moving on.
8. Close the show only when the modal says **Audit clean**.

## NOT DONE

- Cranberry mileage is 0 in the show, so gas is not calculated. Set it in ✏️ Edit Show.
- Booth 2 and 3 crews are not guessed; Froggy assigns them.
- Cutty was not added to anything on the DBW side.
