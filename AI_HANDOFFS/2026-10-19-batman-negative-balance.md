# Batman: negative balance shows

**Problem.** Froggy returned bottles to Batman and gave back more than the app said he owed on 4 sizes. **− Returned to Him** capped each size at what was owed, so the extra was silently dropped: the tally stopped at 0, the log recorded only the capped amount, and the garage only lost the capped amount.

**Fix.**
- **Returned** subtracts the full amount typed. A size can go below 0. The log and the garage use the full amount.
- **Set Exact** accepts negative numbers (no `min="0"`, no floor).
- **Undo** no longer floors the tally at 0.
- The Batman table shows a negative in red with "gave back extra", and a red card lists every negative size. Totals are net.

**Old return.** The extra from the earlier return was never saved anywhere, so the app cannot rebuild it. Froggy re-enters only the extra per size under **− Returned to Him**; that sets the negative and takes the same bottles out of the garage, which still holds them from the capped return.

**Verified:** `tests/batman-history.test.js` 35/35 (1e changed from "capped" to "full amount", plus 1e2 to 1e4). Every other suite passes except the same 8 date-dependent failures already on `main`.
