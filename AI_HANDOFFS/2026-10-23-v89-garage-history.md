# v89: Garage History, hide audit items, Oct 22 garage count put back

**Owner ask (Oct 22 evening):** the Fox & Found and Andre-paid audit items don't matter and keep coming back; the garage count was off again after a hard count; the app must not keep resetting.

**Why counts moved (most likely).** From the sync bug fixed in #91: the phone could not save to the cloud after a show went to Missed, and #88's "Load the cloud copy" prompt pulled the stale cloud (old garage, old Batman, the Missed show back as finished, so its audit item came back). #91 removed that prompt and lets the phone save. Also `auditSyncReturns()` silently moves the garage when a closed show's counts are edited (by design since v41), with no garage-level trail.

**What v89 adds**
- **Garage History** (Stock → Garage, under Set All): every change to `S.inventory` with time and reason, in `S.settings.garageLog` (last 300). `garageCheck()` runs on every save, on app open (catches updates and cloud loads), after Load the cloud copy and after a restore. The baseline is per device (`dd_bs_garage_seen`). Reasons: +/− and typed on Stock, Set All, closed-show recount, the last modal title (pack, close, transfer, restock), or the page.
- **Audit "Hide this"** on every item, stored in `settings.audit.hidden` (`showId|code`, `showId|*`, `rep|id`). `auditAll()` filters it out; `auditAllRaw()` is the unfiltered list.
- One-time **`audit_hide_fox_andre_v89`**: hides every item for Oct 2026+ Fox & Found shows, and Andre's overpaid item.
- One-time **`garage_count_oct22_v89`** (runs last in `applyOneTimeUpdates`): sets the garage to the Oct 22 7:39 PM CT hard count from the owner's screenshots (32oz 118, 16oz 141, 8oz 263, 2oz 352, C5-S 517, C5-L 300). Skipped if a transfer happened after it or a show from Oct 23 on is packed. Waits on a fresh device. Logged in Garage History and the audit log.

**v90 (same day):** the count is what stayed in the garage after TJ's 244 for A Fair to Remember went out; that show was packed after the count, so v89 skipped. One-time `garage_count_oct22_v90` puts the garage back to the count, letting only the Fair to Remember pack through (any transfer or other Oct 23+ show still skips it).

**Verified:** `tests/garage-history-v89.test.js` 22/22.

**v91 (same evening):** after v90 the garage read 1,691 but At Shows read 0. A Fair to Remember (Fall, Oct 23-24) was packed for TJ on the afternoon of Oct 22, before the 7:39 PM count. Loading the stale cloud copy undid that pack, so the show sat at "planned". (v90 itself was harmless: the garage already equalled the count.) One-time `ftr_fall_pack_v91` marks the show packed again (32oz 12, 16oz 20, 8oz 47, 2oz 60, C5-S 70, C5-L 35) without touching the garage. It runs only while the show is still planned with no counts or money. `tests/garage-history-v89.test.js` 29/29.
