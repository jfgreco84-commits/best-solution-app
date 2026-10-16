# v76: Fox & Found North Aurora (Oct 17) packed for Isaiah

**Date:** 2026-10-16 · **Branch:** `claude/rustic-fox-inventory-k13w5n` · **App:** v75 → v76

## REQUESTED

Froggy is sending Isaiah to this weekend's Rustic Fox market in North Aurora
(on the board as **Fox & Found — North Aurora (Oct)**, Sat Oct 17 2026, 77 mi)
with this from the garage, and wants it entered without doing it by hand:

| Product | Sent | + travel sets | Packed |
|---|---|---|---|
| 32oz | 12 | | **12** |
| 16oz | 10 | | **10** |
| 8oz | 48 | | **48** |
| 2oz | 80 | +19 | **99** |
| C5 Small | 140 | +19 | **159** |
| C5 Large | 24 | | **24** |
| Travel sets | 19 | split above | |
| **Total** | 333 | | **352 units** |

A travel set is one 2oz Best Solution + one C5 Small, so the 19 sets are
counted into those two sizes (the app has no travel-set SKU).

**Follow-up the same day:** Froggy also took 32oz 108, 16oz 60, 8oz 24 from
Mom's and wants it on **Borrowed from Batman**.

## COMPLETED

**Batman borrow** (`batman_borrow_oct16_v76`, `bmBorrowOct16(d)`): same as
**+ Borrowed More**, dated 2026-10-16, note "Took from Mom's". Owed to Batman
up 108/60/24 (192 bottles), garage up the same, one History entry (id
`bmh_v76_oct16`, `src:'app'`, so the ✕ in History undoes it). Runs **before**
the pack so the garage holds the stock. Waits for a device whose Batman tally
holds bottles, like v75. Never books twice (flag + entry id).

**Show pack:**

One-time load step `fox_found_oct_pack_v76` (`foxFoundOctPack(d)`) does exactly
what **Pack for Show → Start Show** does:

- garage (`S.inventory`) down by the amounts above
- `packedInventory` set, day 1 morning count set to the same
- prices frozen on the show, status → active
- Isaiah (`rep_isaiah`) added to the crew; marked **👥 CREW-RUN** (Froggy not working it)
- a note on the show, a 🎒 row in the show's inventory log, an audit log line

**Safety.** Matches only a non-passed show dated 2026-10-17 with "fox" or
"north aurora" in the name. If the show is already packed or started (Froggy
packed it by hand first), nothing is changed. If the garage count is lower than
what went, the show still gets what really went, the garage stops at 0 (never
negative) and the shortfall is written in the log.

## VERIFIED

`node tests/fox-found-oct-pack.test.js` 37/37 (new). All other suites match
unmodified `main` (the same pre-existing failures in passed-not-doing and
product-debt-invoices). `cranberry-scoreboard` and `batman-history` pre-mark
the v76 steps on their blank-board full loads, as they already do for other migrations.
Booted in Chromium: v76, no page errors.

**Live data changed:** No Supabase read or write. The step runs on Froggy's
device the first time the app opens after merge.

## AFTER MERGE

Borrowed from Batman: History shows an Oct 16 borrow of 32oz 108 · 16oz 60 · 8oz 24.

Open the app, open Fox & Found Oct: it should read active, packed 352, crew
Isaiah. Isaiah does the evening count and money at close as usual.

---

## Also in v76: Chicago Women's Expo, Oct 24-25 2026

Migration `chicago_womens_expo_v76`, registered in `MRG_SEED_RECORDS`
(replay-guard 157/157).

| | |
|---|---|
| Show | **Chicago Women's Expo** (30th season, Ultimate Women's Expo) |
| Dates | Sat Oct 24 10am-5pm · Sun Oct 25 11am-5pm |
| Venue | Donald E. Stephens Convention Center, 5555 N River Rd, Rosemont IL |
| Miles | ~70 each way from Waterford (approx) |
| Booth | **$1,095**, paid in full by ACH Oct 13 (Bluevine), receipt confirmed Oct 14 |
| Crew | Froggy + Alivia (`rep_alivia`); Michele added to the roster (`rep_michele`) but not the crew, she is a maybe |

Sources: Froggy's Gmail (Erika Hayward welcome 10/12, Bluevine ACH 10/12 + 10/13,
accounting confirmation + Set-Up Kit 10/14) and public listings for the hours.
Froggy said $1,100; the ACH is $1,095, so the app carries $1,095.

**Not entered:** setup / move-in times, badges, parking and dock. They are in the
Set-Up Kit PDF attached to the 10/14 email, which could not be opened from here.
Notes say so. Exhibit space includes **no tables or chairs**.

**Conflict:** A Fair to Remember, Fall (West Bend) is Fri Oct 23 + **Sat Oct 24**,
the same Saturday. Both are paid. The calendar will show Oct 24 red.

An existing Women's Expo record in Oct 2026 is updated in place (blanks only).
`tests/womens-expo.test.js` 18/18.
