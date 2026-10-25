# v92: rep taken off the crew kept getting paid (Oct 25)

**What Froggy saw:** Chicago Women's Expo, Day summary said Rep Pay $378.67. Only Michele was listed, at $227 typed.

**Why:** Alivia was taken off the crew, but she still had $151.67 of auto pay on the day (35% of $1,300 split 3 ways). `tableCrew` counted anyone with pay on the show as crew, so she stayed in the split and her pay kept refilling. The Rep Pay Today list only showed reps on the crew, so her $151.67 was in the total but invisible.

**Fix:**
- `tableCrew` now counts the crew list plus anyone with actual sales. Pay alone no longer puts someone on the crew. Auto pay for a rep taken off the crew drops on the next sync. Pay you typed by hand stays.
- Rep Pay Today lists everyone with pay on the day, with a red "not on the crew, still paid" line for anyone off the crew, so the rows always add up to the total.
- Edit Day Pay lists those people too, so their pay can be cleared.

Test: `node tests/off-crew-pay-v92.test.js`. Pre-existing date-based failures in passed-not-doing and product-debt-invoices are unrelated (fail on main too).

## Follow-up: Alivia did not come Saturday, works Sunday

- New per-day "Not here today" link next to each rep in Rep Pay Today (shows without booths). It sets `day.offCrew`. That rep stays on the show's crew, is left out of that day's split, and their auto pay for that day goes. "Was here" undoes it.
- One-time `cwe_alivia_sat_off_v92`: Chicago Women's Expo (Oct 24): Alivia back on the crew, marked not here on day 1, her day 1 auto pay removed. Sunday she fills in normally.
- Note: Michele's pay was typed by hand, so under the v80 rule she stays manual for the whole show. Her Sunday pay has to be typed too. Clearing every day of her pay sends her back to automatic.
