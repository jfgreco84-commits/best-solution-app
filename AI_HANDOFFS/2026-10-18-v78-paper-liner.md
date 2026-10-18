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

## VERIFIED

`tests/expense-audit.test.js` 56/56. Every other suite matches `main` (passed-not-doing 5, product-debt-invoices 3 fail there too).
Live data changed: no. The backup was read locally only; nothing from it is committed.
