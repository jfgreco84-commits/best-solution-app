# v70: sync safety (data-recovery round)

| | |
|---|---|
| **Date** | 2026-10-01 |
| **Branch** | `claude/best-solution-recovery-m4nr4q` |
| **App version** | v69 → **v70** |
| **Review state** | **Draft. Not deployed. Needs Justin's approval before merge.** |
| **Live data changed** | **No.** No Supabase read or write was made from this round. |

## Diagnosis

`cloudPull()` returned `null` for **both** "no row in the cloud" and "the read
failed" (network, expired login, server error, unparseable row).
`cloudHydrate()` answered `null` with `cloudPush()`, an **unconditional upsert
of the whole device copy**. On a wiped or fresh phone that copy is not empty:
the app seeds **33 shows, 16 other expenses and a Martone ledger, 0 finished**,
and `looksUsed()` calls that "used" data. One failed read on sign-in or boot
was enough to replace the real cloud document with the defaults.

The v67 guard (`_cloudDoneSeen`) did not cover this: it is only set by a
**successful** read, so after a failed one it is 0 and every push passes.
Three more paths wrote without a fresh read: Sync Now, the `online` event, and
any `saveS()` after a failed hydrate. Emergency restore stamped the Sep 26/v66
copy as the newest and pushed it straight to the cloud.

## The fix (v70)

- `cloudRead()` returns exactly one of **ok** (with the row's `updated_at`
  token), **none** (server answered, no row), **error** (everything else,
  including a row that is not app data or has no version stamp).
- **Read errors abort all writes.** `_cloudVerified` is true only after an ok
  or none read. `cloudPush()` refuses without it. Sync Now and reconnect
  re-read first instead of pushing.
- **Compare-and-swap.** Every write is `UPDATE … WHERE updated_at = <token
  from the read>`. Zero rows matched = another device saved first: nothing is
  written, sync stops until a fresh read. When no row exists the first write
  is an `INSERT`, which fails instead of overwriting if a row appeared.
- **Protocol stamp.** Every write carries `_syncProtocol: 2`. A cloud doc
  stamped higher is never written over (newer code wrote it).
- **Behind the cloud + Cancel = pause, not overwrite.** Declining "load the
  newer cloud copy" used to push this device's older copy over it.
- **Dated cloud snapshot before any write.** `dd_bs_cloudsnap_<ts>` (newest 3)
  is kept on the device after every successful read, and listed in
  Setup → Device Backups.
- **Emergency restore is local only** and no longer stamps the old copy as
  newest. `restore.html` carries a STOP banner (Sep 26, 19 finished).
- **v69 cannot double.** The Martone $2,000 and WWW $418.90 carry stable ids,
  are skipped if the same amount on the same date is already on the ledger,
  and still require the running total to be exactly 3000 / 250. The invoice
  normaliser now keeps a payment's `id`.

Not done here, proposed as a later phase: replacing whole-document sync with
an append-only payment/event log. That is an architecture change to a frozen
app and should be its own approved round.

## Test evidence

`node tests/sync-safety.test.js` → **43/43**. Before the fix, against v69:
a failed read (auth error, network throw, garbage row) on a fresh device made
2 writes and the fake cloud went from **20 finished shows to 0**.

| Scenario | Result |
|---|---|
| Forced failed read ×3 kinds, then save, then Sync Now | 0 writes, cloud keeps 20 finished |
| No row → first upload | one INSERT; INSERT over a row that appeared is refused |
| Good read, adopt cloud, save | conditional UPDATE pinned to the read token |
| Conflicting version (other device wrote after our read) | 0 rows matched, other write survives, no further writes until re-read |
| Cloud doc from a newer protocol | 0 writes |
| Device behind cloud, owner taps Cancel | 0 writes |
| v69 migration run twice / with hand-entered $2,000 | invoice #2 stays $5,000 paid / $985 left, one 9/30 entry |

`node tests/compare-tools.test.js` → **18/18** (tools are read-only by source
inspection; report flags a duplicated v69 payment and a lost show).

Every other suite unchanged: 16 suites green; `passed-not-doing` (5 of 430)
and `product-debt-invoices` (3 of 109) fail **identically on unmodified v69**
(date-sensitive fixtures).

## Difference report: status

**Not run yet. The two inputs are not in this container.** The Sep 30
backups are on Justin's OneDrive Desktop and the cloud has not been read.

1. On a **computer** (not the phone with the app open), open
   `tools/cloud-snapshot.html` (served from the branch or a local copy), sign
   in, download the snapshot. One SELECT, no writes, sign-in not remembered.
2. Open `tools/compare.html`, pick A = one of the Sep 30 backups, B = the
   snapshot. It prints SHA-256s, invoice-by-invoice balances, the v69 status
   on each side (marker, number of 9/30 $2,000 and $418.90 entries), WWW,
   Cranberry close-out, shows only on one side, inventory, reps, markers,
   settings, and the raw field diff. Download the .txt.
3. Send the report (or both files) to Claude. The data stays out of this
   public repo.

## Proposed live change list (nothing below has been done)

1. **Merge v70** (deploys the app code to GitHub Pages). Before merging: do
   not edit anything in the tab that is open now, it still runs v69 and its
   saves are unconditional.
2. **Server-side guard (Supabase SQL, optional but recommended).** Stops any
   still-cached v69 tab, keeps a server copy of every replaced version:
   a `before update` trigger on `app_data` for `data_key='bs_state'` that
   rejects writes without `_syncProtocol >= 2` or with fewer finished shows
   than the stored row, and inserts the old row into `app_data_history`.
   Exact SQL to be shown before it runs. Side effect: Phase 2B writes would be
   refused (its documents are not stamped); Phase 2B is a finished one-time tool.
3. **Recovery write**: only after the difference report, and only the exact
   records it shows are missing, applied to a copy first, then one
   compare-and-swap write. Invoice #2 target **$5,000 paid / $985 left** is to
   be confirmed against the backup's ledger ($3,000 on Sep 30 backup + the
   $2,000) and against the cloud's v69 status, so the $2,000 and the $418.90
   are not added twice.
