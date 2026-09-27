# v53: commission tally on the Money tab

**Date:** 2026-09-27 · **App version:** v52 → **v53**

Froggy: per day, each booth's number, team, what they sold, volume, and the 35% each person has coming. TJ + Dave split theirs in half; Les and Anthony each work on their own; Cutty gets half of 35% of the booth he works with Froggy (Froggy's half is not paid).

`commissionDay(sh,di)` / `commissionCardHTML(sh)`, top of the Money tab. Per booth-day: 35% of that drawer (`showCommRate`, default 0.35, `sh.commissionRate` overrides).
- Owner on the crew → other crew split the 35% evenly, owner's share kept.
- Drawer split by person (sellerPayments) → each person 35% of their own sales.
- Otherwise → even split across the crew.
Shows what's already entered as day pay (✓ or "entered $X"), and a per-day "Use these as day pay" button (writes `day.repPay`, logged). Whole-show total per person.

Real data: Fri pays out $1,445.34 (Cutty 296.63, TJ / Dave 261.98 each, Les 388.50, Anthony 236.25); Sat $1,513.59 (Les 397.25, Anthony 409.50, Cutty 344.58, TJ / Dave 181.13 each). Rendered at 390px, no errors.
