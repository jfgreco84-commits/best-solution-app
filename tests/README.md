# Tests

The app is a single HTML file served straight from `main` by GitHub Pages, with
no build step and no package.json. These tests need nothing installed:

```
node tests/phase2b.test.js
node tests/replay-guard.test.js
node tests/booking-pipeline-filters.test.js
node tests/product-debt-invoices.test.js
node tests/passed-not-doing.test.js
```

`harness.js` extracts the inline `<script>` blocks from `BEST_SOLUTION_APP.html`,
runs them in a Node `vm` with a stub DOM, and returns the sandbox so a test can
call the app's own functions directly. The app file is never modified.
`boot(seed)` optionally pre-fills localStorage, which is how a test simulates a
page refresh that finds a value already on the device.

`booking-pipeline-filters.test.js` covers the three tap-to-filter cards on the
Shows page. The invariant it exists to protect is that a card's displayed count
and the list that card opens are the same array — both come from
`pipelineBuckets()` — so they can never drift apart.

`product-debt-invoices.test.js` covers the Product Debt page, where a supplier
is a stack of sequential invoices rather than one rolling balance. The
invariant it protects is that no figure on the page or in an export is ever
produced by adding one invoice's total or payments to another's: a settled
invoice is frozen history, the open invoice is the only one a payment can land
on, and a new invoice changes neither. The expected ledger is read from the
app's own `PD_MM_SEED`, and the pre-migration fixture is rebuilt from it, so
the figures are not duplicated here.

`passed-not-doing.test.js` covers the Passed / Not Doing show state and the
Apply Show Update Package feature. The invariant it protects has two halves
that pull against each other: a passed show must be invisible to every
forward-looking surface (Upcoming, the pipeline buckets and owed total,
deposit alerts, booth owed/due, booked counts, calendar, .ics, conflicts,
stock transfers) while being completely preserved as a record — including
booth money already spent, which stays in the books. A change that satisfies
one half by breaking the other is the failure this file exists to catch, so
most checks assert both sides of the same fact. It also replays the shipped
package twice to prove no duplicate show and no duplicate payment can be
created, and asserts that Wonderful World of Weddings comes through the whole
sync byte-for-byte unchanged.

## Fixtures are synthetic

Every fixture in this directory is invented. No real export, no real financial
figures, and no customer information is committed to this repository, which is
public. The Supabase client in the Phase 2B tests is a fake the test file fully
controls, so no test can reach a real account.

The three show identities in `P2B_MANIFEST` are read from the app rather than
retyped, so the tests assert against the real manifest without duplicating it.
