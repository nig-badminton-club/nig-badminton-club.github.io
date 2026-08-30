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
