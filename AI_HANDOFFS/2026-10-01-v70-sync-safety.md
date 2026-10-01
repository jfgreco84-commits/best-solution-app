# v70: sync safety (data-recovery round)

| | |
|---|---|
| **Date** | 2026-10-01 |
| **Branch** | `claude/best-solution-recovery-m4nr4q` (PR #67, **draft**) |
| **App version** | v69 → **v70** |
| **Review state** | Round 2: the four verified review findings and the tool notes are addressed below. **Not deployed.** |
| **Live data changed** | **No.** No Supabase read or write, no server change, no live snapshot. |
| **Approved by this round** | Nothing live. Merge, deploy, server SQL, live capture and any recovery write each need separate approval. |

## Diagnosis (unchanged, confirmed by review)

`cloudPull()` returned `null` for both "no row" and "read failed", and
`cloudHydrate()` answered `null` with an unconditional upsert of the device
copy. A wiped phone is not empty: it seeds **33 shows, 16 other expenses and a
Martone ledger, 0 finished**. One failed read could replace the cloud.

## The sync rules in v70

A device writes the cloud document only when it can show the write drops
nothing the cloud has:

1. **A successful read this session.** `cloudRead()` returns ok / none / error,
   never conflated. Read errors block every write path (boot, saves, Sync Now,
   reconnect).
2. **This device descends from what the cloud holds.** `dd_bs_syncbase`
   records the row version this device last matched and the `_updatedAt` it
   had then. On each read:
   - cloud unchanged since the base: push this device's edits, if any;
   - cloud moved, no local edits since the base (or identical data): take the
     cloud copy (device copy backed up first);
   - **cloud moved AND local edits: diverged. Nothing is written** until the
     owner chooses in **⚠️ Sync needs you**: *Load the cloud copy*, or
     *Overwrite the cloud* (typed `OVERWRITE CLOUD`, a fresh read showing the
     cloud has not moved since the comparison, and never with fewer finished
     shows than the cloud). A device with no base yet (every device on its
     first v70 load) is treated as diverged unless its data is identical.
3. **Compare-and-swap.** Each write is `UPDATE … WHERE updated_at = <read>`
   (plus `AND revision = <read>` with `revision+1` once the server guard
   exists). Zero rows = conflict: blocked and marked diverged. First write
   with no row is an INSERT at revision 1 (retried without the column until
   the guard adds it); an INSERT over a row that appeared fails.
4. **Restores are quarantined.** Every restore/import (`_applyStateObj`:
   emergency restore, Device Backups, backup file, paste import) and
   `restore.html` cancels the pending autosave and sets
   `dd_bs_sync_quarantine`, which survives reloads. Nothing syncs until the
   owner resolves it the same way as a divergence.
5. **Phase 2B no longer hands its token to ordinary sync.** After its write
   the ordinary sync is blocked and marked diverged; the next read either
   takes the Phase 2B result (no local edits) or asks the owner.

`_syncProtocol` is still stamped, as a forward-compatibility marker only. **It
is not protection against old clients** (finding 3: v69 keeps whatever stamp a
document already has).

Also in this PR: dated cloud snapshots on the device after each read (listed
in Device Backups); v69 Martone $2,000 / WWW $418.90 carry ids and are skipped
when already on the ledger; the invoice normaliser keeps payment ids.

## Old v69 tabs: only the server can stop them

`tools/proposed-server-guard.sql` (**proposal, not applied**): adds
`app_data.revision`; a `bs_state` insert must carry revision 1 (Postgres fires
BEFORE INSERT for every proposed row of `INSERT … ON CONFLICT`, which is what a
v69 upsert is, so every v69 save is refused whether or not the row exists); an
update must set exactly revision+1 and keep user/key; deletes refused; every
replaced or deleted version copied to `app_data_history` (owner can read, not
write, via RLS). Phase 2B sends no revision, so it is refused too.

Verified on a throwaway local Postgres 16 shaped like the app table
(`bash tests/server-guard.test.sh`, **22/22**): v69-style upsert with a stale
`_syncProtocol: 2` copy refused and the stored value kept; plain update
refused; v70 CAS lands and bumps revision; a second device on the old
revision matches zero rows; skipped revision, delete and key change refused;
first insert needs revision 1; other `data_key`s untouched; history written
through the guard for the signed-in role and not forgeable under RLS.

**Not verified, check before applying:** the real column types (read-only
query in the SQL header), that the function owner in Supabase bypasses RLS
for the history insert, and the project's auth/session settings.

## Test evidence (final head)

| Suite | Result |
|---|---|
| `sync-safety.test.js` | **76/76**. The same file on the previous head (207520c): **30 of 75 fail**, reproducing all four findings (conflict + Sync Now 300→100; emergency restore with a queued autosave 300→100; reload of a restored copy INSERTs or writes; Phase 2B result replaced by an ordinary save) |
| `compare-tools.test.js` | **33/33** (on the previous tool files the 7 snapshot checks fail and the exhaustive diff is missing) |
| `server-guard.test.sh` | **22/22** on real Postgres 16 |
| 14 other suites | all pass, counts unchanged |
| `passed-not-doing` | 5 of 430 fail, **identical on unmodified v69**. Controlled-date run (Date injected into the test sandbox): **430/430 at 2026-08-26** on both v69 and v70, 3 fail mid-September, 5 today. Date-dependent fixture. |
| `product-debt-invoices` | 3 of 109 fail, **identical on unmodified v69**, at every pinned date. **Not date-related:** passes through v41, fails from v42 (`fc5a53c`), whose new one-time updates add markers the test's "only marker it adds is its own" check does not expect. Stale test, not this PR. |

Real Chromium: the app boots with no errors and the resolve screen renders;
the snapshot page loads its pinned library over HTTP and a tampered copy is
blocked by the integrity check.

The INSERT-race test now really reaches the INSERT (the fake table creates
the row between the read and the write) instead of stopping at the read gate.

## Tools

**`tools/cloud-snapshot.html`.** One filtered SELECT, in-memory login.
Changes from round 1: pinned, vendored `@supabase/supabase-js` 2.117.2
(npm tarball integrity `sha512-eSG2VKnH…BOXg==` matched the registry; the page
pins the file with a sha384 SRI), sign-out moved into `finally` (no-row and
error paths included) with its error reported, password field cleared, blob
URL revoked, and the wording corrected: it creates a temporary server login
session and downloads a file; it sends no save/update/delete. **Single-session
behaviour of the real project is unverified**; if live capture is approved,
use a separate browser profile on a computer, with Justin typing his own
credentials.

**`tools/compare.html` + `bs-compare.js`.** The .txt is a capped summary
(400 raw diffs, 80-char values, 200 settings) and now says so. New
**exhaustive .json diff**: every difference, full values, both files' full
SHA-256, for exact repairs. Full hashes in the summary too. Results are
cleared when a comparison starts or either input changes, so a failed second
comparison leaves nothing downloadable. Keep inputs and reports out of this
public repo.

## Difference report: status

**Not run.** Needs the Sep 30 backup and a cloud snapshot, which needs
separate approval for the live capture.

## Proposed live change list (none done; each needs approval)

1. **Merge PR #67** (deploys v70). Every device's first v70 load asks once
   (Load the cloud copy is the normal answer). Until then do not edit in any
   open v69 tab.
2. **Apply `tools/proposed-server-guard.sql`** after the read-only column
   check. This is what actually stops old tabs. Roll-back statements are in
   its header.
3. **Live snapshot capture** with the snapshot page, then the comparison.
4. **Recovery write**: only the exact records the exhaustive diff shows
   missing, rehearsed on a copy, one compare-and-swap write. Invoice #2 target
   $5,000 paid / $985 left to be confirmed against both copies first so the
   $2,000 and $418.90 are not added twice.

Follow-up outside this PR: the main app still loads
`@supabase/supabase-js@2` unpinned from a CDN.
