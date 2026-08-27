# LATEST

Handoffs: **[2026-08-26-show-sync.md](2026-08-26-show-sync.md)** (v1 - merged, deployed as v33) - **[2026-08-26-show-sync-v2.md](2026-08-26-show-sync-v2.md)** (v2 - merged, deployed as v34) - **[2026-08-26-show-sync-v3.md](2026-08-26-show-sync-v3.md)** (v3 - this correction, in review)

| | |
|---|---|
| **Date** | 2026-08-26 |
| **Branch** | `claude/show-sync-v3-2026-08-26` |
| **Base** | `1aa4d0e` on `main` (carries the merged, deployed v34) |
| **App version** | **v34, unchanged - v3 is data-only** |
| **Review state** | Approved by Scout. **Merged and deployed.** |
| **Merged** | **Yes** - PR #29 squashed into `main` as `b293ecc188969ee40ad97a2a1f785e9174849c4b`. |
| **Deployed** | **Yes** - Pages build `built` in 34.9s. App unchanged at **v34** (v3 is data-only). |
| **v3 package URL** | <https://jfgreco84-commits.github.io/best-solution-app/packages/2026-08-26-show-sync-v3.json> |
| **Live data changed** | **No.** No package has been applied. No real Supabase read or write has been made or attempted. |

## Why there is a v3

Scout analysed Justin's three-copy export. **Party on the Pavement is absent
from both device and cloud**, while the `pop_racine_20260818` migration marker
still records it as seeded - so the marker suppresses re-seeding and nothing
brings it back. v2's operation was a `markPassed`, which only ever *matches* an
existing record, so on the real board it returned **UNMATCHED and skipped**: the
decision to pass on the show left no trace anywhere.

v3 replaces that operation with a create-or-update carrying the passed fields,
so the historical record is reinstated already in Passed / Not Doing. The other
five operations are byte-for-byte v2's. **No app-code change** -
`BEST_SOLUTION_APP.html` is byte-identical to `main`.

**One invariant is bypassed and Scout should rule on it:** an `upsertShow`
writing `passed:true` does not go through `pndMarkPassed()`, so it skips that
function's refusal to pass a completed or active show. Not reachable for this
package on this board (Party is absent; its date is in the future), bounded and
visible if it ever were. Full analysis in the v3 handoff.

**Verified:** 349/349 checks passing, three consecutive runs. Preview counts
against the exported 44-show board: **6 operations - 50 field changes - 2 new
records - 0 blocked** (Scout's measured v2 figure of 31/1 plus the measured
+19/+1 delta from the one changed operation).

**Deployed and byte-verified.** The v3 JSON GitHub Pages serves is
byte-identical to the committed blob (`c3f2e0c7`, SHA-256 `bb2c65ea...`,
11,300 bytes), and that blob id is the same one at the reviewed commit. The app
is untouched at v34, and the v1 and v2 packages are unchanged. **Neither
package has been applied.**

---

# Previous rounds

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
