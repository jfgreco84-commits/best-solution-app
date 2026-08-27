# v35 — one-tap Load Latest Approved Package

**Branch:** `claude/v35-approved-package-loader`
**Base:** `eabf68e` on `main` (carries the merged, deployed v34 and the v3 package)
**App version:** `v34` → `v35`
**State:** awaiting Scout's review — **not merged, not deployed, nothing applied**

---

## REQUESTED

Replace "find the file, download it, open the app, choose it" with one button.
Fetch a committed same-origin catalog, verify the package's SHA-256 before
parsing it, open the existing preview automatically, keep every existing gate,
keep paste and upload as a manual fallback, recognise the two spellings of the
v3 package id as one package, and show a friendly already-current screen with
no Apply button when either id is already recorded.

---

## COMPLETED

### What the button will fetch, and nothing else

`packages/approved-show-packages.json` names the one reviewed package. Its
`file` is a **bare filename** — no slashes, no scheme, no dot-dot — checked
against `/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/` before it is used for anything.
The app resolves it inside its **own** `packages/` directory, derived from
`location` and never from the catalog. Then it checks the **result** again:
same origin, and pathname still inside that directory.

A tampered catalog cannot point the app at another host, another repo, or
anywhere outside `packages/`, because the only thing it contributes to the URL
is a filename that has to survive a character-class test first. Two dozen
off-limits shapes are pinned by test — other hosts, protocol-relative,
absolute, traversal, encoded traversal, `data:`, `javascript:`, `file:`, query,
fragment, wrong extension, empty, null.

### Checksum before parse

The package is fetched as **bytes**, hashed with SHA-256, and compared before
anything parses it. A mismatch refuses without `JSON.parse` ever touching the
payload.

`pkgChecksumMatches()` is the single place that decides what "matches" means,
and everything that is not a clean 64-hex match refuses — **including a null
digest** from a browser without subtle crypto. There is no branch anywhere that
treats "could not compute" as "fine", which is the failure this feature would
otherwise quietly have.

### Aliases

`pkg_2026-08-26_show_sync_v3` and `pkg_2026-08-26_show-sync_v3` are one
package. `PKG_ALIASES` declares the pair in both directions, and
`pkgIsApplied()` is now alias-aware — so the idempotency gate holds through
**paste and file upload too**, not only through the new button.

It is a **table, not a normaliser**. Folding every hyphen/underscore pair would
also merge two genuinely different packages whose ids happened to differ that
way, and silently refusing a package the owner actually needs is its own
failure. A test pins that a lookalike pair *not* in the table stays separate.

### Already current

If either id is recorded, the button shows **"You already have the latest
approved show update"** — the package is never fetched, because the cheapest and
most useful answer comes first. The screen carries **no Apply control and no
confirmation checkbox**, deliberately: offering one would invite a double-apply
the gates would then have to refuse. When it matched through the alias it says
which id the board actually recorded, so an id the owner has not seen before
does not look like a mystery.

### Gates unchanged

The loader ends by calling the existing `pkgRenderPreview()`. Signed in, online,
synced, backup prompt, one explicit confirmation, fresh cloud preflight, awaited
push, cloud verification — none of it touched. Paste and Choose File remain,
now behind a disclosure that says plainly that a package loaded that way is
**not** checksum-verified.

### `.gitattributes` — a footgun closed

The catalog pins a hash of the **committed** bytes, which is what Pages serves.
A Windows checkout with `core.autocrlf=true` rewrote these files with CRLF, so
they hashed differently and the button refused a clone that was in fact correct.
`packages/*.json text eol=lf` pins them, and the working copy now matches the
committed blobs byte for byte. The refusal text still names line endings as an
innocent cause, because the failure is indistinguishable from a real tamper
without it.

---

## DECISIONS

1. **A bare filename, not a path.** The catalog could have carried
   `packages/foo.json` and been validated. Requiring a filename makes traversal
   and absolute URLs *unrepresentable* rather than merely caught — the resolver
   never sees a separator to reason about. The resolved-URL checks stay anyway,
   because a rule you can only state one way is a rule you cannot cross-check.
2. **Already-applied is answered before fetching.** No point downloading and
   hashing a package to tell the owner he already has it.
3. **The refusal names the innocent cause.** A checksum refusal on a local
   checkout is indistinguishable from a real tamper without it, and a confusing
   refusal trains people to click past refusals.
4. **A test seam, not a `window.location` stub.** `pkgResolveInPackages(file,
   baseHref)` takes an optional base so the origin rules — the part most worth
   testing — can be tested in Node *and* in a real browser, where
   `window.location` is not assignable. Production calls pass nothing.

---

## CHANGED

| File | Change |
|---|---|
| `BEST_SOLUTION_APP.html` | Catalog loader, resolver, checksum gate, alias table, already-current screen, button in two places, paste/upload demoted to a disclosure, `APP_VERSION` v35 |
| `packages/approved-show-packages.json` | **New.** Names v3, its alias, its SHA-256 and byte count, plus superseded history for v1 and v2. |
| `.gitattributes` | **New.** `packages/*.json text eol=lf`. |
| `tests/passed-not-doing.test.js` | Section 13. 349 → **430** checks. |
| `tests/README.md` | Documents section 13. |

Untouched: `SB_URL` / `SB_KEY`, all RLS behaviour, Mailchimp, every package
file, and all live show data.

---

## VERIFIED

**430 / 430 passing, zero failures**, three consecutive runs, 17 sections,
`R.done()` reached, no exceptions, clean console on a fresh load. Node is
unavailable here, so the committed test file was executed verbatim in a real
browser via the adapter described in the v1 handoff.

### Live, driving the real button

| Scenario | Result |
|---|---|
| Happy path (LF files matching the catalog) | Checksum verified, preview opened automatically, banner names the package and its reviewer, Apply + checkbox + Download Backup all present, **loading changed nothing** |
| CRLF working copy | **Refused.** `expected bb2c65ea… / got 96cbfbb2… (11490 bytes, expected 11300)`, nothing parsed, no Apply, state unchanged, line endings named as the innocent cause |
| Catalog checksum tampered to `aaa…` | **Refused**, nothing parsed, no Apply, state unchanged |
| Catalog `file` repointed to `https://evil.example/pkg.json` | **Refused** — "will not fetch" |
| Already applied under the **underscore** id | Friendly screen, **no Apply button**, names the recorded id and the applied time |
| Signed out | Preview still opens and is still checksum-verified; Apply and checkbox **absent**; `pkgApply()` called directly still **refuses** with state unchanged |

### Catalog integrity

Every `sha256` and `bytes` in the catalog was checked against the **raw
committed blob** — latest and both history entries: **MATCH**. The working copy
now matches those blobs byte for byte too.

### Not executed

- The committed test file under Node.
- The four pre-existing suites — they call `boot()` repeatedly for fresh
  isolated instances, some with pre-seeded `localStorage`, which the browser
  adapter cannot honour. This branch changes `BEST_SOLUTION_APP.html`, so unlike
  the v3 round they are **not** provably unaffected and need Scout's Node run.
- Screenshots — the Browser pane is not displayed in this session.
- **Anything against the real Supabase.** No cloud read or write made or
  attempted; all cloud paths were exercised against a fake client on a throwaway
  localhost origin, signed out of the real account.

---

## The v3 package has already been applied

Recorded here because two earlier drafts of this handoff said the opposite, and
a stale instruction to "apply v3" is exactly the kind of thing that gets a
package applied twice.

Justin applied v3 successfully. From **his saved application report**:

| | |
|---|---|
| Package | `pkg_2026-08-26_show_sync_v3` (the underscore spelling) |
| Local verification | passed |
| Cloud write | completed |
| Cloud verification | passed |
| Update complete | **true** |
| Shows | **44 → 46** |
| Reapply blocked | true |

44 → 46 is the two creations this package makes, which matches the preview
figure of **6 / 50 / 2 / 0** derived for his board. The numbers corroborate each
other.

**Provenance, stated plainly: this comes from Justin's saved application report,
not from a new live Supabase read.** Nothing in this round queried, read or
wrote his account. The report itself is not committed — it is his business data,
and this repository is public.

## BLOCKED

Nothing.

---

## NEXT ACTION

Scout reviews, ideally with a Node run of all five suites — this round touches
app code, so the four suites I cannot execute here matter more than they did for
v3.

**v3 is already applied. There is nothing left to apply.**

After v35 deploys, Justin opens the synced app and taps **Load Latest Approved
Package**. It must show **You already have the latest approved show update**,
identify that it was recorded under **`pkg_2026-08-26_show_sync_v3`**, and offer
**no Apply control**. Do not reapply the package.

This is the first real use of the alias table: Justin's board recorded the
package under the underscore spelling, and the catalog names the hyphen
spelling. Without the alias the button would have offered to apply a package he
already has, and the idempotency gate would have had to catch it one screen
later. Seeing the already-current screen instead is the feature working.

Two open items carried forward from v3, neither a blocker: a status constraint
on the matcher so an `upsertShow` cannot set `passed` on a completed show, and
passed shows' projected `showExpenses` still counting as spend in `calcYTD`.
