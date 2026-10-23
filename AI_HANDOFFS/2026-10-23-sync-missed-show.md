# Sync: moving a show to Missed no longer stops syncing

**Problem.** Froggy's phone (the only device) kept showing "Sync error, working offline". The v67 finished-shows guard in `cloudPush()` refused any push from a copy with fewer finished shows than the cloud ever had. Moving a finished show to Missed (v84 auditor "did not happen") or Reopening one legitimately lowers that count, so every save after it stayed on the phone. The cloud fell days behind (it still had the pre-Oct-19 Batman counts), and the Setup card hid the reason (it printed only "Sync error, working offline").

The Oct 22 "behind" prompt (PR #88) made this worse: it offered "Load the cloud copy" on that stale cloud. **Removed.**

**Fix.**
- `cloudPush()`: the finished-shows guard only applies to a copy that does not descend from the row it would replace (sync base token != the row read). A synced device that moves a show to Missed or reopens it now saves normally. The compare-and-swap still stops writes over a cloud that moved.
- The Setup card shows the block reason after "Sync error".
- The hydrate "behind" divergence from PR #88 is gone.

**Owner, Oct 23:** did a hard garage count on the phone (32oz 118, 16oz 141, 8oz 263, 2oz 352, C5-S 517, C5-L 300 = 1,691). Once the phone opens this version, it pushes that copy to the cloud. Do not load the cloud copy.

**Verified:** `tests/sync-safety.test.js` 131/131. Section 9b fails 7/7 on the old code with the phone's exact symptoms.
