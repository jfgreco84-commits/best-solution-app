# v97 Small Sets built at the show (Oct 26 2026)

| | |
|---|---|
| **Branch** | `claude/sets-built-at-show` |
| **App version** | v96 → **v97** |
| **Tests** | `node tests/sets-built-at-show-v97.test.js` (15 checks, new, on Froggy's real Oct 25 counts) |
| **Live data changed** | **No.** No one-time update. The fix is in the math, so the Chicago Women's Expo reads right as soon as v97 loads. |

## REQUESTED

Froggy, Chicago Women's Expo, Oct 25:

- The table opened with SET 0, 2oz 151 and C5-S 123.
- It closed with SET 22, 2oz 111 and C5-S 86. The 22 sets were built at the table from 2oz + C5-S.
- The app read 40 2oz and 37 C5-S as sold, flagged "SET ended at more than started", and called the drawer $365 short.
- He wants the sets to come out of both products evenly.

## WHAT CHANGED

**`setsBuiltOf` / `daySetsBuilt` / `boothSetsBuilt`:** more SET at night than the table had (morning + restock + booth moves) means that many sets were built there.

- Each one took a 2oz and a C5-S off the table, not to a customer.
- Built is capped at what the 2oz and C5-S actually went down, so a typo can never invent sales or stock. Anything over the cap is still flagged.

Every reader follows from it:

- **`dayUnitsLeft` and `boothUnitsLeft`:** sold, COGS and the cash check leave out the 2oz and C5-S that went into sets.
- **Booth shows:** the day adds up its booths.
- **`invNegativeSold`:** built sets are not "more than it started".
- **`showLedger` (booth / truck shows):** 2oz and C5-S go down, SET goes up, so the truck still adds up.
- **`endShowReturns`:** the packed fallback is moved the same way. What goes home is still what is on the table.
- **`saveCount`:** the 🛑 typo warning allows the built sets.
- **`bxView` (Full Export):** the same rule.

## OCT 25 BEFORE / AFTER

| | v96 | v97 |
|---|---|---|
| 2oz sold | 40 | **18** |
| C5-S sold | 37 | **15** |
| Full-price value | $980 | **$584** |
| Drawer ($615) | $365 short | **$31 over** |
| SET flag | red | **none** |
| Going home | 111 / 86 / 22 sets | 111 / 86 / 22 sets (unchanged) |
| COGS | $259.41 | **$153.81** (the 22 sets are not sold yet) |

## STILL OPEN (ask Froggy)

- The $31 over is most likely sets that were built and sold during the day: the app only sees the 22 left, so a set sold at $20 reads as a 2oz + C5-S ($18).
- If he wants it exact, the next step is a "sets made today" number on the day. With it, sold sets = made − left, and the drawer would match.
