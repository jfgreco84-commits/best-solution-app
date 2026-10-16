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

## COMPLETED

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

`node tests/fox-found-oct-pack.test.js` 26/26 (new). All other suites match
unmodified `main` (the same pre-existing failures in passed-not-doing and
product-debt-invoices). `cranberry-scoreboard` and `batman-history` pre-mark
v76 on their blank-board full loads, as they already do for other migrations.
Booted in Chromium: v76, no page errors.

**Live data changed:** No Supabase read or write. The step runs on Froggy's
device the first time the app opens after merge.

## AFTER MERGE

Open the app, open Fox & Found Oct: it should read active, packed 352, crew
Isaiah. Isaiah does the evening count and money at close as usual.
