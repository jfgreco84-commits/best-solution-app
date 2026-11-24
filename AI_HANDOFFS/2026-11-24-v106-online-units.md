# v106 Online bottles count in Units Sold (Nov 24 2026)

| | |
|---|---|
| **Branch** | `claude/notion-integration-handoff-jm8h4w` |
| **App version** | v105 → **v106** |
| **Tests** | `node tests/online-units-v106.test.js` (10 checks) |
| **Live data changed** | None. Display and totals only, no one-time update. |

## REQUESTED

Froggy, Nov 24: "yes add online bottles to units sold." Online sales money, bottle cost and postage were
already in the P&L and tax reserve since v79; only the unit count left them out.

## WHAT CHANGED

- `calcYTD` adds each online sale's bottles (`olTotals(Y).bySku`) into `units` and `totalUnits`, by sale date and year.
- New `showUnits` in the `calcYTD` result keeps the show-only count. The restock pace in Master Inventory
  (`secInventory`, units per selling show) reads `showUnits`, so mailed bottles do not inflate "shows left".
- Units Sold card label now reads "Total Units Sold (shows + online)".
- Season Totals in the accountant package and the Units Sold dashboard tile follow `totalUnits`, so they include online bottles.
- Unknown SKUs on an online record are ignored (no NaN).

## STILL OPEN

- Date-based failures on main, unrelated and unchanged: `gas-area-v93` (3), `passed-not-doing` (7), `product-debt-invoices` (4).
