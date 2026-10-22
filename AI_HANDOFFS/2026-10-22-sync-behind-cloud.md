# Sync: a device behind the cloud can load it (no more dead end)

**Problem.** Froggy's phone showed Batman owed 2,192 (Sep 30 counts + Oct 16 borrow, history "Returned 0") with a red dot: "Not syncing: the cloud has 24 finished shows, this device 23 ... sign out and back in." Signing out and back in did nothing. The phone's sync base still matched the cloud row, so `cloudHydrate()` took the "cloud not moved" path and tried to push, and the v67 finished-shows guard refused the push. No divergence was raised, so the owner never got the **Load the cloud copy** button. Stuck on "working offline" forever.

**Fix.**
- `cloudHydrate()`: if the cloud has more finished shows than the device, raise a `behind` divergence (opens **⚠️ Sync needs you**). Runs on app load and on Sync Now.
- `cloudSyncNow()`: a push refused as `cloud protected` re-reads the cloud, which raises the same choice.
- The resolve box says "this device is behind, load the cloud copy". The toast now says "Setup → Sync Now to load it".
- Overwrite the cloud is still refused while the cloud has more finished shows. Loading the cloud keeps the device copy in Device Backups (`backupLocal`).

**Live data changed:** No. Nothing written to Supabase from here.

**Owner steps:** open the app, Setup → **Sync Now** → **Load the cloud copy**. Then check Borrowed from Batman (Oct 19 return left 2oz 96, C5-S 274, others 0, before the extra on 32oz/16oz/8oz/C5-L is entered).

**Verified:** `tests/sync-safety.test.js` 134/134 (new section 9, fails on the old code).
