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

`passed-not-doing.test.js` covers the Passed / Not Doing show state, the
Apply Show Update Package feature, and the v2 package correction. The invariant it protects has two halves
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

Sections 10 and 11 pin the v2 correction. The live cloud held "The Last Fling
Artisan Market" while the v1 package named "The Last Fling"; those normalize
differently, so v1's exact name+date match missed and the operation fell
through to CREATE a second record on the same day at the same venue. Section 10
runs both packages against a board carrying the real record and asserts v2
updates it in place while two decoys - the same event name on another date, and
a same-named event at another organizer - are left byte-for-byte untouched.
Section 12 pins the v3 correction. Party on the Pavement is absent from the
real board while its migration marker still suppresses re-seeding, so v2's
markPassed - which only ever matches an existing record - returned UNMATCHED
and the decision left no trace. Section 12 covers create-when-absent,
update-in-place-when-pending, no-change-when-already-passed, blocked-and-
untouched when a same-named show sits in the wrong town, and reapply producing
nothing. It also pins each half of the passed contract separately: out of every
bucket, alert, total, calendar, conflict and transfer target, AND present in
Passed / Not Doing history.

Section 13 covers the v35 one-tap loader. The rules that make a one-tap fetch
safe at all are the ones under test: the catalog is validated before it is
trusted, a catalog-supplied filename can only ever resolve inside the app's own
packages/ folder (a table of two dozen off-limits shapes -- other hosts,
protocol-relative, absolute, traversal, encoded traversal, data:, javascript:,
file:, query, fragment -- must all be refused), a SHA-256 that is anything other
than a clean 64-hex match refuses (including a null digest, which must never
read as 'fine'), the two spellings of the v3 package id are recognised as one
package in both directions, and the already-current screen offers no Apply
control.

Section 11 covers the guards that make that class of bug hard to reintroduce:
near-duplicate detection on same-date overlapping names, an update refusing to
proceed when it matches more than one record, and startDate genuinely narrowing
a nameContains selector.

## Fixtures are synthetic

Every fixture in this directory is invented. No real export, no real financial
figures, and no customer information is committed to this repository, which is
public. The Supabase client in the Phase 2B tests is a fake the test file fully
controls, so no test can reach a real account.

The three show identities in `P2B_MANIFEST` are read from the app rather than
retyped, so the tests assert against the real manifest without duplicating it.
