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
