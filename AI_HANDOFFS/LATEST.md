# LATEST

Most recent handoff: **[2026-08-26-show-sync.md](2026-08-26-show-sync.md)**

| | |
|---|---|
| **Date** | 2026-08-26 |
| **Branch** | `claude/show-sync-2026-08-26` |
| **Base commit** | `b710a03` |
| **App version** | v32 → **v33** |
| **Deployed** | **No.** `main` is untouched; Pages still serves v32. |
| **Live data changed** | **No.** No cloud write was made or attempted. |

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
   asked for or stored, no direct Supabase call, no RLS change, no service-role
   bypass. Idempotent by `packageId` and, independently, per operation.

3. **`packages/2026-08-26-show-sync.json`** — the first package: creates The
   Last Fling and Mistletoe & Martinis, passes Party on the Pavement and the
   four cancelled Rustic Fox holiday shows, and creates the replacement Rustic
   Fox Holiday Market. Wonderful World of Weddings is deliberately untouched.

## State of play

- **Nothing has reached Justin's live data yet.** The package still has to be
  applied by him, inside the app, while signed in. See NEXT ACTION in the full
  handoff.
- **Node is not installed on this machine.** `tests/passed-not-doing.test.js`
  was written but could not be executed. 137 equivalent checks were run against
  the fully booted app in a real browser and all passed. Full detail, including
  everything that could not be run, is in the VERIFIED section of the handoff.
- Merging this branch to `main` deploys v33 to GitHub Pages. That decision has
  not been made.
