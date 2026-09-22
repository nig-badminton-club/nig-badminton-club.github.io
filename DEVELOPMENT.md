# Development and Pages delivery

Use Node 24 (`.node-version`), npm and Python 3. After `npm ci`, `npm run check`
runs all public JavaScript syntax checks, HTML validation, static file/data/link
checks, the private-data pattern scan, jsdom/axe rendering tests and Pages
recovery tests. This is the same command CI runs. No Google credentials are
needed. The public `scripts/` directory now holds only these development tools;
Apps Script source and deployment bindings remain in the private operations repo.

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
