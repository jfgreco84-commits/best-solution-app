# v88: Batman debt put back to after the Oct 19 return

**Problem.** After PR #88, Froggy loaded the cloud copy and it still showed Batman owed 2,192 with History "Returned 0": the cloud itself is a copy from before the Oct 19 return (32oz 119, 16oz 84, 8oz 147, 2oz 343, C5-S 1054, C5-L 445).

**Fix.** One-time `batman_oct19_return_v88` (`bmFixOct19Return(d)`) sets the debt to what the Oct 19 return left, read from that day's screenshots (session "Negative balance visibility"): **32oz 0, 16oz 0, 8oz 0, 2oz 96, C5-S 274, C5-L 0 = 370**. One History entry, type `set`, dated 2026-10-19. Debt only, like Set Exact: **the garage is not changed.**

Runs only on the stale copy: no `return` in History AND C5-S 1054 AND C5-L 445. Any other copy is left alone and marked done. Waits on a blank device.

**Still open (owner):**
- The extra given back on 32oz, 16oz, 8oz, C5-L on Oct 19 was never saved; enter it as a negative if wanted.
- The garage on this copy may still hold bottles returned Oct 19. Per-size split for 2oz/C5-S is not on record. Recount the garage.
- Anything borrowed after Oct 19 is not in this copy.

**Verified:** `tests/batman-oct19-fix.test.js` 11/11.
