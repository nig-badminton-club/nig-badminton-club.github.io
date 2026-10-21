# Development and Pages delivery

Use Node 24 (`.node-version`), npm and Python 3. After `npm ci`, `npm run check`
runs all public JavaScript syntax checks, HTML validation, static file/data/link
checks, the private-data pattern scan, jsdom/axe rendering tests and Pages
recovery tests. This is the same command CI runs. No Google credentials are
needed. The public `scripts/` directory now holds only these development tools;
Apps Script source and deployment bindings remain in the private operations repo.

The check entrypoint runs JavaScript syntax, HTML validation, static validation
and the test stage concurrently. It waits for every stage and returns failure
if any stage fails, retaining all diagnostics. The test stage includes Node
behavior/recovery tests and Python public-data/link validation tests. Python
bytecode output is disabled so the tests leave no cache files in the checkout.

`VERSION`, `package.json` and `package-lock.json` must share the release version.
The 0.1.3 update also replaces the affected transitive URI parser with compatible
`fast-uri` 3.1.6. It is a validation dependency, not browser code shipped in `docs`.

`ci.yml` validates each commit once. Its `deploy` job can call the reusable
`pages.yml` only after `validate-site` succeeds, and only for `main` outside a pull
request. Pages checks out that same commit and uploads `docs` with one-day artifact
retention. Superseded CI runs are cancelled. No branch settings are changed.

For an authorized manual delivery, dispatch **CI** on `main`:

```sh
gh workflow run ci.yml --ref main
```

Recovery listens for unsuccessful CI completion on the trusted repository's
`main` and retains a six-hourly check for missed push events, plus manual dispatch.
It uses only the default-branch API helper, not the failed run's checkout. It
does not install or execute pull-request dependencies with its write token.

The helper checks only the current head's runs. It skips a successful or active
run, caps recovery dispatches at three per head, and verifies the head again
before dispatch. A recovery attempt reruns CI, so validation is never bypassed.
Inspect Actions after the cap is reached; do not raise it to mask a code failure.
Tests execute the actual shell helper with a fake GitHub CLI for success, active
runs, failed/missing runs, API errors, the retry cap and head advancement.

The schedule retains cancellation and tentative-state text after the fourth
practice, including accessible text in the compact date list. Public payload
fields are unchanged. The operations repository owns historical attendance
snapshots; deploying this static site does not deploy or migrate that system.

## Choosing local checks

The 0.1.16 browser scripts share `assets/public-data.js` for loading, validation
and safe links. JSONP calls have distinct callbacks, retain timeout cleanup and
fall back only on transport failure. Successful malformed responses still fail
validation. About skips schedule filtering/sorting and practice-date formatter
creation; its photograph reserves its dimensions and loads lazily. Chart hover
work runs at most once per animation frame, uses the latest pointer position and
keeps tooltip DOM when the selected point is unchanged. Taps remain immediate.
Rendering tests cover these paths, cancellation text, TSV output and unsafe links.
These changes have no payload, participant-rule or endpoint configuration change.

Run from this repository's root. Confirm `node --version` is v24.15 or newer within 24.x and
`python3 --version` succeeds, then `npm ci`. `.node-version` is a selection file,
not an automatic runtime switch. The locked jsdom requires at least Node 24.15
on the 24.x line. Installation needs the npm registry; checks use local fixtures
and mocked fetch/GitHub CLI, with no Google credentials.

| Change | Focused command while iterating |
| --- | --- |
| Browser JavaScript, rendering, schedule or attendance/export data | `npm run lint` then `node --test tests/site.test.mjs` |
| HTML, links, config or public JSON | `npm run validate:html` then `npm run validate:site`; also rendering tests for displayed data |
| Pages recovery helper or delivery wiring | `node --test tests/recovery.test.mjs` |
| Static validation or the check entrypoint | `python3 -B -m unittest discover -s tests -p '*_test.py'` and `node --test tests/check.test.mjs` |
| Styles, bilingual prose, analytics or other browser configuration | Static checks plus direct review of the affected page/configuration; tests do not establish prose accuracy or analytics delivery |

Use `npm run check` before push, including development-document changes because
the private-data scan reads those too. Success means exit 0 with no failed tests
or validation errors. There is no separate type checker. Recovery tests create
and remove temporary fake CLI fixtures; running `scripts/recover_pages.sh`
directly is an external GitHub action, not a local test.

For page changes, `npm run serve` serves `docs/` at `http://localhost:4173/`.
Check desktop and narrow layouts, then stop the server with Ctrl-C. Browser
preview may load configured third-party resources; it is separate from the local
mock suite. Do not modify automation-maintained `docs/data/public.json` just to
simulate a state: rendering tests accept in-memory fixtures.

## Public data loading and TSV output

The browser reads `docs/data/config.js`. With the intentionally blank
`NIG_BADMINTON_PUBLIC_JSONP_URL`, it fetches `data/public.json` relative to the
page with `cache: "no-store"`. A configured JSONP URL is tried first; a load
error or five-second timeout falls back to the committed JSON. There is no
server-side environment-variable or CLI override and no local build/cache to
regenerate. Use the HTTP preview rather than opening HTML via `file:`.
The schedule, attendance and membership pages use the same loading order and
reject unsuccessful HTTP responses before rendering their JSON bodies.

`attendance.html` derives its chart and download from `sessions`: valid
`YYYY-MM-DD` dates strictly before today in Asia/Tokyo, non-`cancelled` status,
and finite numeric `attendingCount` are required. Today and future dates are
excluded; a null/missing attendance count is unavailable, not zero. Missing or
non-numeric `guestCount` is rendered as zero; negative numeric counts are
clamped to zero by the consumer. This is display behavior, not a substitute for
validating source data.

Optional `noPracticeWeeks` records use only `weekStart` (Monday), `weekEnd`
(Sunday), and `reason: "no-reservation"`. The operations publisher records these
from successful reservation syncs. The attendance page shows current and past
confirmed weeks as squares and week ranges in the breaks table. It does not
infer missing weeks, count them as zero participants, or add them to the TSV.
An actual session in the same week takes precedence over a no-practice record.

The download is generated in the browser as `nig-badminton-attendance.tsv`;
the browser chooses its destination and handles repeat-download filenames.
No TSV is written into the repository by `serve` or `check`. It is UTF-8 with
a BOM, tab separators and CRLF line endings, ordered by ascending date:

| Column | Meaning |
| --- | --- |
| `date` | Practice date, `YYYY-MM-DD` |
| `attending_count` | Members whose Form response indicates attendance, people |
| `guest_count` | Registered guests, people |
| `total_participants` | Sum of the preceding two counts, people |

These are planned participation counts, not confirmed physical attendance or
unique people across multiple practices. The table shows the latest 20 records
in descending date order; the chart and TSV include all qualifying records.
The download is disabled when no records qualify.

Recorded past sessions with `status` or `responseStatus` equal to `cancelled`
are shown separately: year-specific × marks below the participant chart, with
hover/tap details, and a complete reverse-chronological cancellation table.
Valid dates strictly before today in Asia/Tokyo are required; counts may be null.
`publicNote` supplies the public reason/notices; blank notes display
"Reason not recorded / 理由未記録". Cancellation-only years remain visible.
Cancelled sessions do not become zero-person data points or enter the attendance
TSV. Dates absent from `sessions` are not inferred to be cancellations.

## Test review policy

Keep tests for plausible user-visible failures, not a target count or coverage
percentage. The September 2026 review covered all three test files:

- `site.test.mjs` retains dynamic schedule states, date/list boundaries, form
  availability, private-data exclusion, injection prevention, stale-data warnings,
  attendance totals/exports and structural accessibility. Date and key-pickup
  assertions share existing rendering scenarios instead of opening extra DOMs.
- `recovery.test.mjs` retains the actual shell helper's dispatch decisions,
  independent error/branch/rerun boundaries and the same-commit validation gate.
- `workflows.test.mjs` was removed: runner choice and a fixed timeout are deployment
  preferences rather than evidence that recovery works.

Static prose, analytics attributes/tag IDs, search-verification text and chart
source spelling are no longer frozen by tests. This accepts loss of those
configuration/copy smoke checks; the deleted analytics tests never checked event
emission. Review such changes directly. HTML, local links and private-data patterns
are checked by `npm run check`; the duplicate private-sheet URL assertion was
removed from the HTML test. Accessibility checks remain despite their higher cost
because malformed rendered page structure can prevent actual use.

The October 2026 follow-up retains accessibility scans on all four rendered
pages and every recovery-shell scenario in the default suite. Fake GitHub CLI
responses use Bash and prewritten JSON while the real recovery shell and jq
filters still execute. Rendering fixtures observe the DOM update instead of
waiting 20 ms on every page; missing rendering fails after a bounded timeout.
The fee-copy test was merged into the existing injection scenario, which now
checks that dynamic policy text is displayed safely. No suite is skipped.

Measured on macOS with Node v24.19.0 on 2026-10-09, against `2e48bb5`, running
`node --test --test-reporter=tap tests/*.test.mjs` three times before and after,
with no concurrent repository tests or builds: median full-suite wall time fell
from 2.34 s to 1.85 s (21%). The respective trial ranges were 2.25–2.52 s and
1.78–2.18 s. All tests passed (30 before, 29 after consolidation); these local
timings do not include dependency installation or predict CI runner timings.

The 2026-10-13 audit expands structural accessibility scans to all eight club
pages. Response states, reservation details, privacy and the four-card boundary
share one mixed schedule fixture; all earlier assertions remain. Each scan
uses an independent DOM and closes it immediately. Real browser checks also
cover color contrast, which jsdom cannot establish. Static validation now
checks calendar dates, unique session IDs, numeric/null count semantics,
cancellation consistency, approved session fields and internal anchors.

Measured on macOS with Node v24.19.0, using the same 33 Node tests, five Python
tests, locked dependencies and validation stages, with one warmup and three
timed runs per candidate and no concurrent repository tests/builds: changing
`npm run check` from sequential stages to `scripts/check.mjs` reduced median
wall time from 5.674 s to 2.642 s (53%). Ranges were 5.066–5.976 s and
2.564–2.702 s. Peak RSS stayed about 446 MiB. Reproduce the sequential workload
with `npm run lint && npm run validate:html && npm run validate:site && npm test`,
and compare with `npm run check`. All checks remain mandatory; these local
measurements exclude installation and do not predict CI runner timings.

## 2026-10-15 efficiency review

The review covered public-data loading, schedule and attendance rendering,
chart/export work, styles/assets, membership/admin links, validation, tests and
Pages recovery. Schedule dates now share one Japanese `Intl.DateTimeFormat` per
page instead of constructing one for the next practice and every displayed date.
For 52 upcoming dates that reduces practice-date formatter constructions from
53 to one. Tokyo timezone, labels, cancellation states, payload fields, loading
order and downloads are unchanged. Script query versions were updated on both
pages that load `app.js`.

The public-data pattern scan now prunes `.git`, `node_modules` and `build` before
descending into them. The same source files and patterns remain covered, with
real-entrypoint fixtures for nested excluded trees and hidden source files.
Data/link validation, every accessibility scan and all recovery cases still run.

Reproduce the date-formatting comparison from this root with Node 24:

```sh
node --expose-gc scripts/benchmark_schedule.mjs
```

The default baseline is `5fa30a77144e1e82fceafd7c9790f8b8a34852bb`; an optional
first argument selects another locally available commit containing `app.js`.
The benchmark extracts the actual date-formatting code from both candidates,
includes formatter initialization per page, warms both paths and alternates five
trials of 20 simulated pages. Values below are per-page CPU medians for the next
practice plus every upcoming date. Each trial compares formatted strings; complete
jsdom-generated schedule HTML also matches for every fixture.

Measured on macOS arm64 with Node v24.19.0 and the locked dependencies, on
2026-10-15, with benchmarks run serially without repository checks/builds:

| Upcoming dates | Previous formatting median | Reused formatter median |
| --- | ---: | ---: |
| 12 | 0.787 ms | 0.272 ms |
| 52 | 3.173 ms | 0.126 ms |
| 260 | 33.767 ms | 1.526 ms |

The largest fixture ranged from 12.10–54.03 ms before and 0.32–2.48 ms after.
These measure date formatting only. Full-page jsdom rendering was noisy, so no
overall page-load speedup is claimed. Network, browser layout and DOM setup are
excluded. Optional explicit GC runs between batches outside the timed workload;
whole-process peak RSS was 362.3 MiB across compatibility checks and both paths,
not a comparison of browser memory use.

For the static validator, keep the same installed dependencies and working tree:

```sh
git show 5fa30a77144e1e82fceafd7c9790f8b8a34852bb:scripts/validate_site.py > /tmp/nig-site-validation-before.py
python3 /tmp/nig-site-validation-before.py
python3 scripts/validate_site.py
```

With Python 3.9.6, one warmup per path and five alternating subprocess timings,
median validation time fell from 313.99 ms to 130.64 ms (58%); ranges were
270–627 ms and 107–172 ms. Exit status and output matched. Peak child RSS across
the comparisons was 19.9 MiB, not a per-path memory measurement. Installation and
whole-suite time are excluded. Local browser review of schedule and about pages
at 1280×900 and 390×844 found matching dates/member counts, no horizontal overflow
and no JavaScript console errors.

## Documentation changes

Keep the Japanese and English explanations aligned with the deployed behavior.
The role page is the participant-facing reference for selection order, workload
points, newcomer grace and manual exceptions. Review it together with the
workflow page whenever deadlines or replacement instructions change. The
private operations repository owns the corresponding implementation and Form,
email and admin-console text.

The privacy page must describe the actual use of responses and private member
records, as well as current and retained historical public aggregates. Keep the
README's public-data policy aligned with it. Do not add private diagnostics or
operational identifiers to public documentation.

Run `npm run check`, verify internal links and view affected pages at desktop
and narrow widths before pushing. Existing checks catch markup, data and
rendering problems; they do not prove that prose matches the business rules.

## Initial site setup reference

The current organization site is already configured. The following is only a
reference for recreating a site, not a routine deployment sequence:

1. An organization root site uses a repository named
   `nig-badminton-club.github.io` under the `nig-badminton-club` organization.
2. Push the site source and workflows to the default branch.
3. Select GitHub Actions as the GitHub Pages source in repository settings.
4. Confirm successful CI and Pages delivery at the organization site URL.

A different repository name produces a project-site URL with a repository path,
so check URL and asset handling before using that layout. Do not change the
existing repository's Pages configuration as part of ordinary maintenance.
