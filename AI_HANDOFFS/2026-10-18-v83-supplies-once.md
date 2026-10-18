# v83 supplies counted once, no owner lunch on rep-only shows (Oct 18 2026)

| | |
|---|---|
| **Branch** | `claude/supplies-once-v83` |
| **App version** | v82 → **v83** |
| **Tests** | `node tests/supplies-once-v83.test.js` (12 checks); `expense-audit` 2a now checks both modes |

Froggy, after v82: "Out of 41k!? Still too low. Find where I am probably messing up." This is a line-by-line audit of the Oct 17 board.

## App errors fixed

1. **Gift bags and shelf liner were counted twice.**
   - Every bag and liner order is in Business Purchases: organza bags, T-shirt bags, pouches, and three liner orders ($133).
   - v77/v78 also charged them on every show: bags per bottle sold ($256.60) and half a liner roll per show (about $150).
   - Now they count once, as purchases (`supplyFromPurchases()`, default on; `settings.supplyFromPurchases:false` restores the per-show charge). Paper towels have no purchase logged, so they stay per show. The snapshot engine mirrors this (`V.fromPurch`).
   - Effect: **+$406.60**.
2. **A rep-only show charged the owner's $20 lunch.** Now `showLunchCost` returns 0 when `repOnlyShow` (V mirrors it). Effect: +$20 today (Fox & Found Oct).

## Real board (local only)

| | v81 | v82 | **v83** |
|---|---|---|---|
| Net profit | $4,838.49 | $7,909.39 | **$8,335.99** |
| Keep (after 28%) | $3,483.71 | $5,694.76 | **$6,001.91** |

The P&L reconciles, engines agree, and a second load changes nothing.

## Where the $41,418 goes (v83)

| Line | Amount | Note |
|---|---|---|
| Sales tax owed (card sales) | $751.86 | |
| Product cost | $10,576.24 | 26% of gross |
| Rep pay + worker payouts | $9,915.00 | 24% of gross; 2025 had almost none |
| Booths worked + lost on missed shows | $4,836.00 | |
| Business purchases | $2,757.61 | |
| Gas + lodging | $1,720.07 | |
| Show/day expenses | $850.65 | |
| Lunch | $835.00 | |
| Supplies (paper towels) | $352.91 | |
| Card fees | $473.67 | |
| Postage | $13.00 | |

## Board items for Froggy (not changed by code)

- **Fox & Found Oct 17:** 90 units sold ($1,235 at full price), $0 money entered, shows −$430.29. Entering the money adds roughly $700 after Isaiah's 40%.
- **10 shows list one rep and not the owner but are not marked Rep-only:**
  - McHenry (TJ)
  - Maxwell Jul (TJ + Snacks)
  - Rustic Fox Jun, Aug (Isaiah), Jul (Andre), Sep (Anthony)
  - Fox & Found Jun (Andre), Jul and Sep (Isaiah)
  - Girls Day Out (Alivia)

  They carry the owner's lunch ($320), owner paper towels ($46.61) and auto gas from Waterford ($390.15). If Froggy was not there and did not pay their gas, that is about $757 too much. McHenry's note says TJ's gas was paid, so its gas stays.
- **Fox & Found Sep 19:** $1 cash, 0 units sold, Isaiah pay $1, everything returned. It looks like the show did not happen; as completed it costs $69.92.
- **McHenry (6 days):** the note says TJ was guaranteed at least $100/day plus gas. Pay entered is $1 (day 1) + $330 (day 6) = $331, and $0 is logged paid. Worth a look (it could mean more pay owed).
