# LATEST

Most recent handoff: **[2026-08-26-show-sync.md](2026-08-26-show-sync.md)**

| | |
|---|---|
| **Date** | 2026-08-26 |
| **Branch** | `claude/show-sync-2026-08-26` |
| **Base commit** | `b710a03` |
| **App version** | v32 → **v33** |
| **Review state** | Scout conditionally approved; final clean run **186/186, zero failures**. |
| **Merged** | **Yes** — PR #27 squashed into `main` as `d4abc73a3e6210ad600d67cb8cd05d682ab6e4ec`. |
| **Deployed** | **Yes** — GitHub Pages build `built` in 39.9s. https://jfgreco84-commits.github.io/best-solution-app/BEST_SOLUTION_APP.html serves **v33**. |
| **Live data changed** | **No.** The package has NOT been applied. No real cloud read or write has been made or attempted. |

## What changed

1. **Passed / Not Doing** — a stored, reversible show state for a show we chose
   not to work, or that the organizer cancelled. Out of Upcoming, the Booking
   Pipeline, payment-due alerts, the calendar, the .ics export, conflicts,
   stock transfers and every booking total — while the record itself is fully
   preserved, and any booth money already paid stays in the P&L. It is never
   labelled Missed, and never deleted.

2. **Apply Show Update Package** — Settings → 📦. Loads a reviewed JSON batch of
   show changes, shows a complete before/after preview, takes one confirmation,
   and saves through the owner's own signed-in session. No password is ever
   asked for or stored, no second Supabase client, no RLS change, no
   service-role bypass. Idempotent by `packageId` and, independently, per
   operation.

3. **`packages/2026-08-26-show-sync.json`** — six operations: creates The Last
   Fling, Mistletoe & Martinis and the replacement Rustic Fox Holiday Market;
   passes Party on the Pavement and the four cancelled Rustic Fox holiday shows
   via two location-constrained operations. Wonderful World of Weddings is
   deliberately untouched.

## Round-2 corrections (Scout audit of `12a06ba`)

- **Apply now requires signed in + online + `_syncState === 'synced'`**,
  enforced inside `pkgApply()` itself and not only by hiding the button.
  Previewing while signed out is still allowed; applying is not.
- **Fresh `cloudPull()` immediately before any mutation.** If the cloud is newer
  or materially different, it aborts with zero local changes. `pkgApply()` is
  async, awaits the real push, then re-reads the cloud and verifies the returned
  document. The report shows **local verification / cloud write / cloud
  verification** separately and reads `LOCAL CHANGE APPLIED / CLOUD UNVERIFIED`
  with recovery steps if anything short of all three.
- **Sweeps now require organizer/location evidence**, split into separate North
  Aurora and Carol Stream operations. A same-named show at another organizer is
  excluded and reported by name.

**Two real bugs in the round-1 code were caught by building these** — notes were
being read as identifying evidence (and prose negates: "nothing to do with The
Rustic Fox" matched), and `pkgPlan()` was mutating state despite being
documented read-only, which would have made every apply abort as a false
divergence. Both fixed, both now have regression tests. Details in the handoff.

## State of play

- **The code is live. The DATA is not.** v33 is deployed and serving. The show
  package has **not** been applied — Justin still has to do that himself, inside
  the app, signed in and synced. See NEXT ACTION in the full handoff.
- **Node is still not installed on this machine.** The committed
  `tests/passed-not-doing.test.js` cannot be run by `node` here. For the final
  pre-merge run it was executed **verbatim, unmodified**, in a real browser
  against a pristine `git archive` export of the reviewed commit, via a browser
  adapter supplying `require`/`fs`/`boot`/`reporter`. Result: **186/186
  passing, zero failures**, reproduced identically on three consecutive runs.
- **Deployment verified:** the file GitHub Pages serves is byte-identical to the
  committed blob (`7f99a1ca…`), which is the same blob Scout reviewed at the PR
  head. Reviewed → merged → deployed, same bytes throughout.
- **Post-deploy checks on the live build:** identifies as v33; the Apply Show
  Update Package card is present; Apply is unavailable signed out, offline,
  unsynced, and on sync error; and `pkgApply()` refuses on its own — with an
  applyable 46-change plan and the confirmation gate forced open — making zero
  state changes and **zero network calls**.
