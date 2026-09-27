# v49: Cranberry weekend fixed (Friday relabel, Saturday entered, truck gap)

**Date:** 2026-09-27 · **Base:** v48 (same branch, unmerged) · **App version:** v48 → **v49**

## What Froggy told us (Sep 27)

- Booth numbers follow the TABLE; crews rotate. Friday: Booth 1 = Froggy + Cutty, Booth 2 = TJ + Dave, Booth 3 = Les + Anthony. Saturday: Booth 1 = Les + Anthony, Booth 2 = Froggy + Cutty, Booth 3 = TJ + Dave.
- An 80-count box of 2oz sat at Booth 2 all along and was counted as 24 8oz.
- Saturday: truck → Booth 1 C5L 34; → Booth 2 C5L 24 + 8oz 24; → Booth 3 C5L 24. Truck after: C5L 42, C5S 140, 8oz 48. 36 2oz moved Booth 2 → truck AFTER the close count.
- Saturday opens / closes / money per booth (in the migration).

## Finding

v47 was right about which counts go with which drawer, but the app had Friday's Booth 2 and 3 NUMBERS on the wrong tables. Saturday's openings follow table numbers (Booth 1 Sat open = Booth 1 Fri close + 34 C5L exactly; Booth 2 Sat open starts 21 / 37 = TJ + Dave's Friday close).

## Done: `cranberry_weekend_v49`

1. Friday: swap the Booth 2 / Booth 3 cards whole (counts + money + seller split + restock) and set Friday crews. Friday sales and money unchanged.
2. Saturday: crews, openings, closes, money (Booth 1 split Les / Anthony) as sent.
3. Saturday truck count 0/0/48/0/140/42; packed fixed by the exact gap 2oz +80, C5S −6, C5L +42 (only if the gap is exactly that). Friday's truck count marked superseded.

Guards: Friday must be exactly v47's state (endings and $1,785 / $1,497), Saturday must have no close or money yet, Saturday not locked. Sunday untouched. Logged on the show and in the audit log.

## Verified on the Sep 26 backup (v47 then v49 in one load)

- Fri: sold 13/12/56/87/78/51, $5,147.50 of product, $4,977 collected. Booth 1 (Froggy + Cutty) −$275, Booth 2 (TJ + Dave) +$369.50, Booth 3 (Les + Anthony) −$265.
- Sat: sold 17/16/59/105/116/51, $6,127.50 of product, $5,309 collected. Booth 1 (Les + Anthony) −$357.50, Booth 2 (Froggy + Cutty) −$343.50, Booth 3 (TJ + Dave) −$117.50.
- Truck after Saturday 0/0/48/0/140/42; at show 42/92/197/146/428/190 (= Sat closes + truck). Audit clean. Reload: no double apply.
- Show through Saturday: gross $10,286, COGS $2,136.63, profit $5,333.13 (Saturday rep pay not entered yet).
