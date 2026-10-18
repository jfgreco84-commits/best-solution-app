# v78: paper towels by real count, shelf liner every 4 shows

**Date:** 2026-10-18 · **Branch:** `claude/paper-liner-v78` · **App:** v77 → v78

## REQUESTED (Froggy, after seeing v77 take $1,477.87 off the year)

1. Shelf liner is reused: **2 rolls every 4 shows**.
2. Paper towels fluctuate: **16 rolls at Cranberry, 4 at Burgoo**.
3. Lunch stays: food from home is still money spent.

## COMPLETED

- **Shelf liner:** half a roll per show, $6.25 at $12.49/roll (was 2 rolls, $24.98).
- **Paper towels:** each show takes a real count (`sh.paperRolls`, ✏️ Edit Show → "Paper towel rolls used (actual)").
  Without one, the estimate is rolls per person per show day, **default 1** (Setup, editable). A real count of 0 is 0.
- **Migration `paper_actuals_v78`:** Cranberry Fest 2026 = 16 rolls, Burgoo 2026 = 4 rolls, only where no count was entered.
- **Lunch:** unchanged, $20 per show day; skipped only where food receipts are logged (those receipts are the food).
- Snapshot engine (`bxView`) mirrors it.

## REAL BOARD (Froggy's Oct 17 backup, 24 worked shows)

| | v76 | v77 | **v78** |
|---|---|---|---|
| Expenses | $24,532.34 | $26,010.21 | **$25,155.25** |
| Net profit | $5,533.40 | $4,055.53 | **$4,910.49** |
| Change vs v76 | | −$1,477.87 | **−$622.91** |

v78 vs v76: lunch +$840.00, liner +$150.00 (24 x $6.25), paper +$352.91, old $30 flat −$720.00.

## AUDIT ROUND (Oct 18, same PR)

Code review of v77/v78 + full check of Froggy's real board (Oct 17 backup). Engines (`calcShow` vs `bxView`) agree on every show,
P&L lines reconcile, break-even parts sum, a second load changes nothing, every screen and all 120 show tabs render with his data.

Fixed:
1. `V77_PASS` matched ANY 2026 "Kris Kringle" / "Sip and Sleigh"; now only the old Carol Stream / North Aurora placeholders.
   (His board: only placeholders were passed, no collateral.)
2. Moving the gas default could rewrite finished shows from months with no reading; they now keep the old default. Added Apr 2026 $3.83.
3. Miles fill ran every load, so a 0 he typed came back; now one-time only (`v77FillMiles`). Gas freeze stays every load.
4. Town matching used street names ("N Milwaukee Ave, Chicago" = Milwaukee); now only location parts without a street number;
   `/maxwell/` tightened to "maxwell street days".
5. Paper towels / shelf liner logged in Supplies Used were added on top of the automatic cost; now excluded (both engines),
   and hidden from the Supplies Used picker.
6. Lunch: food receipts now count toward the $20/day instead of switching lunch off for the whole show.
7. Kane County Flea Market (Oct 3) had no miles (gas $0); takes the June record's 71 mi.
8. Home and Setup footers showed v8.0 / v7.2; now show `APP_VERSION`.

Real board after this round: profit **$4,827.33** (gas +$68.16 Kane County, lunch +$15 Pewaukee).
Open on his board: Fox & Found Oct 17 still active (close it), Galentine's booth $128 vs $118 paid ($10 shows owed),
Mistletoe $25 owed, Wonderful World of Weddings $418.90 owed, Maxwell Street Jun + Aug show as missed.

## VERIFIED

`tests/expense-audit.test.js` 66/66. Every other suite matches `main` (passed-not-doing 5, product-debt-invoices 3 fail there too).
Live data changed: no. The backup was read locally only; nothing from it is committed.
