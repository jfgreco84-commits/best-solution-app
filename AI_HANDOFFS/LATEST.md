# LATEST

Handoffs: **[2026-08-26-show-sync.md](2026-08-26-show-sync.md)** (v1 work — merged and deployed as v33) · **[2026-08-26-show-sync-v2.md](2026-08-26-show-sync-v2.md)** (this correction)

| | |
|---|---|
| **Date** | 2026-08-26 |
| **Branch** | `claude/show-sync-v2-2026-08-26` |
| **Base** | `44f6551` on `main` (already carries the merged, deployed v33) |
| **App version** | v33 → **v34** |
| **Review state** | Approved by Scout. **Merged and deployed.** |
| **Merged** | **Yes** — PR #28 squashed into `main` as `3ac572036a84e3bf87d06ac02076ee6cd10ccdff`. |
| **Deployed** | **Yes** — Pages build `built` in 32.4s. <https://jfgreco84-commits.github.io/best-solution-app/BEST_SOLUTION_APP.html> serves **v34**. |
| **v2 package URL** | <https://jfgreco84-commits.github.io/best-solution-app/packages/2026-08-26-show-sync-v2.json> |
| **Live data changed** | **No.** Neither package has been applied. No real Supabase read or write has been made or attempted. |

## Why there is a v2

Scout stopped the v1 apply after reading Justin's real preview. The live cloud
already holds:

> **The Last Fling Artisan Market** · 2026-08-30 · Valley Ridge Golf Course, Antioch, IL

The v1 package matched The Last Fling on **exact normalized name + startDate**
against the name `"The Last Fling"`. Those two names are not equal, so the match
missed, the operation fell through to **CREATE**, and it would have put a second
record on the same day at the same venue.

## What changed

**The package.** `packages/2026-08-26-show-sync-v2.json`, id
`pkg_2026-08-26_show-sync_v2`. The Last Fling operation now matches on
`nameContains: ["last fling"]` **AND** `startDate: "2026-08-30"` **AND**
`requiredEvidenceAny: ["valley ridge","antioch"]` — all three must agree — and
carries `keepExistingName: true` so the organizer's actual event name is
preserved rather than renamed to the sheet's shorter one. The other five
operations are byte-for-byte the approved v1 operations. v1 is kept for the
record and is now blocked by the new guard rather than silently duplicating.

**Three matcher fixes in the app** (hence v34):

1. `nameContains` now honours `startDate` when one is supplied. Without it a
   fragment like "last fling" reaches every year's instance of a recurring
   event; with it the selector names one occurrence.
2. **Near-duplicate detection.** On the same start date, one normalized name
   containing the other is treated as the same event and a create is refused —
   at plan time and again inside execute. Show names drift; dates do not. This
   is the guard v1 needed and did not have.
3. An `upsertShow` that matches **more than one** record now blocks instead of
   silently taking `hits[0]`.

## Verification

**Scout executed the committed tests directly with Node:**
`tests/passed-not-doing.test.js` **260/260**, all five repository suites
**806 checks, zero failures**, `git diff --check` clean. That is the first
independent Node run of this work, and it covers the four pre-existing suites
that could never be exercised on this machine.

Reproduced here in a browser: **260 / 260 passing, zero failures**, three
consecutive runs, via the adapter described in the v1 handoff.

Preview counts for v2 against the seeded board plus the live record
(34 shows): **6 operations · 42 field changes · 2 new records · 0 blocked.**
End-to-end with a mocked cloud: board 34 → 36, cloud 36, one Last Fling record
locally and in the cloud, all three verification states YES, 16 cloud checks
passing, reapply produces **0 changes**.

**A third real bug was caught while building this** — `contains` mode returned
mode `'contains'` even with zero hits, so the upsert branch went looking for
`hits[0]` and crashed on an undefined record. The decoy tests hit it on the
first run. Fixed at the source and at the call site.

## Post-deploy verification

Live build confirmed: **v34**, boots clean, no console errors, all v34 matcher
functions present. The v2 package is reachable from the deployed site (HTTP 200,
id `pkg_2026-08-26_show-sync_v2`, six operations), and both the app and the
package are byte-identical to their committed blobs.

Planned read-only against a board carrying the live record, on the deployed
build: **6 operations · 42 field changes · 2 new records · 0 blocked**, and
operation 1 resolves as **UPDATE** against *The Last Fling Artisan Market*
without touching its name.

## Next

**The code is live. The data is not.** Justin applies **v2** — not v1 — himself,
from a signed-in and synced device, after downloading a backup. The preview must
read **6 / 42 / 2 / 0** with operation 1 showing **UPDATE**; if it shows CREATE,
stop.

Still outstanding from the sheet: the payment method for The Last Fling
($68, 2026-08-21) and Mistletoe & Martinis ($100 by phone, 2026-08-25), and the
mileage on the replacement Rustic Fox market.
