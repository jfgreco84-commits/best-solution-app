# v71: A Fair to Remember, Fall + Christmas

**Date:** 2026-10-03 · **Branch:** `claude/fair-remember-show-dates-90ebgm` · **App:** v70 → v71

## What it adds

One-time migration `fair_to_remember_v71` puts both shows on the board (and so on the Calendar tab):

| Show | Days on board | Hours | Setup |
|---|---|---|---|
| A Fair to Remember, Fall | Fri Oct 23 + Sat Oct 24 2026 | Fri 4p-8p, Sat 9a-3p | Fri 11a-4p, Sat 6a-9a |
| A Fair to Remember, Christmas | Sat Dec 12 2026 | 9a-3p | **Fri Dec 11 4p-8p**, Sat 6a-9a |

Washington County Fair Park, West Bend WI, 38 mi. Confirmed (paid + accepted). Direct-sales area (4-H room or Pavilion hallway), 8-ft table and chairs. Booth amount was not on the confirmation email, so `boothCost` is 0: enter it in Edit Show when found.

The Christmas Friday is setup only, so it is not a show day (no sales count, no work-hours day). It is spelled out in the show notes and lives on Google/Outlook as its own event.

## Safety

If a "fair to remember" show already exists in the same month, it is updated in place (confirmed, blank hours filled, notes appended if they carry no setup info) and nothing is created. Registered in `MRG_SEED_RECORDS`; replay-guard 156/156. Other suites unchanged vs `main` (passed-not-doing and product-debt-invoices carry the same pre-existing failures as `main`).

## Live data

No Supabase read or write. The migration runs on Froggy's device on the next app load after merge.
