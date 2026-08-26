# LATEST

Most recent handoff: **[2026-08-26-show-sync.md](2026-08-26-show-sync.md)**

| | |
|---|---|
| **Date** | 2026-08-26 |
| **Branch** | `claude/show-sync-2026-08-26` |
| **Base commit** | `b710a03` |
| **App version** | v32 → **v33** |
| **Review state** | Scout round 2 corrections applied. **PR open, awaiting Scout's final review.** |
| **Merged** | **No.** |
| **Deployed** | **No.** `main` is untouched; Pages still serves v32. |
| **Live data changed** | **No.** No real cloud read or write has been made or attempted. |

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

- **Nothing has reached Justin's live data.** The package still has to be
  applied by him, inside the app, while signed in and synced. See NEXT ACTION in
  the full handoff.
- **Node is not installed on this machine.** `tests/passed-not-doing.test.js`
  was written but could not be executed. 130 of 131 equivalent checks were run
  against the fully booted app in a real browser (the one failure is a
  superseded scratch-fixture assertion, not present in the committed file), plus
  a full end-to-end apply against a mocked Supabase with 13 cloud verification
  checks passing. Everything that could not be run is listed in the VERIFIED
  section of the handoff.
