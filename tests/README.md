# Tests

The app is a single HTML file served straight from `main` by GitHub Pages, with
no build step and no package.json. These tests need nothing installed:

```
node tests/phase2b.test.js
node tests/replay-guard.test.js
node tests/booking-pipeline-filters.test.js
node tests/product-debt-invoices.test.js
```

`harness.js` extracts the inline `<script>` blocks from `BEST_SOLUTION_APP.html`,
runs them in a Node `vm` with a stub DOM, and returns the sandbox so a test can
call the app's own functions directly. The app file is never modified.
`boot(seed)` optionally pre-fills localStorage, which is how a test simulates a
page refresh that finds a value already on the device.

`product-debt-invoices.test.js` covers the sequential supplier invoices on the
Product Debt page. The invariant it exists to protect is that two product orders
are two obligations: each invoice owns its total, payments, balance and status,
a payment lands on exactly one of them, and creating a later invoice leaves the
earlier ones byte-identical. It also converts a document still in the old
single-balance shape and checks nothing is lost doing it.

`booking-pipeline-filters.test.js` covers the three tap-to-filter cards on the
Shows page. The invariant it exists to protect is that a card's displayed count
and the list that card opens are the same array — both come from
`pipelineBuckets()` — so they can never drift apart.

## Fixtures are synthetic

Every fixture in this directory is invented, with one stated exception. No real
export and no customer information is committed to this repository, which is
public. The exception is `product-debt-invoices.test.js`: its expected figures
are the supplier invoice totals, payment dates and amounts the app file itself
already ships in `PD_MM_INVOICES`, and they are written out in the test on
purpose, so the test fails if those figures ever drift. It discloses nothing
that is not already in `BEST_SOLUTION_APP.html` in this same repository. The Supabase client in the Phase 2B tests is a fake the test file fully
controls, so no test can reach a real account.

The three show identities in `P2B_MANIFEST` are read from the app rather than
retyped, so the tests assert against the real manifest without duplicating it.
