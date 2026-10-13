<!-- BEGIN KF AGENT POLICY: source=https://github.com/kfuku52/kf-agent-policy; version=10; sha256=82e3c0eb467582a414d9a6b2feaaaf6f5c8ae330d30f2e3efbf8c303155d0e2e -->
# Common agent policy

Repository-specific instructions override these defaults.

- Follow the user's task scope within higher-priority instructions and execution
  permissions. Complete implementation through affected verification and a result
  report; a plan or investigation ends with its requested deliverable. Continue
  authorized work without repeated approval; identify actual blocking boundaries.
- Inspect the worktree and preserve unrelated changes. Refresh remote information
  when needed; do not merge, rebase, or switch branches merely to inspect it.
- Prefer the default branch when starting work without an established branch.
  Preserve an existing task branch; follow explicit user branch instructions.
  Never create or switch branches solely for a commit, push, release, or PR.
- Change or recommend branch protection only when explicitly asked. Honor explicit
  repository-specific direct-push exceptions; otherwise report a rejected push
  without bypassing protection or inventing a branch or PR.
- Unpublished implementation details may be redesigned; preserve existing public
  APIs, file formats, and saved-data compatibility unless a breaking change is
  authorized. Update affected producers, consumers, tests, examples, and docs.
- Fix verified root causes; do not hide failures with fallbacks or weaker checks.
  Document unavoidable workarounds and their removal conditions.
- Read relevant docs and run the repository's check entrypoint for the change and
  phase. Verify affected behavior; report checks run and omitted. Repeat or broaden
  successful checks only for new changes, failures, or unresolved concerns.
- For library metadata, require demonstrated incompatibility for exact pins or
  upper bounds; keep reproducibility locks separate.
- When editing READMEs, keep them concise with useful visuals inline; put extended
  guides in linked documentation.
- For GitHub push/release work, use `prepare-github-push` in `.agents/skills/`.
  Local-only commits need no version bump; GitHub pushes require one.
- For software performance work, use `benchmark-performance` in `.agents/skills/`.
  Performance claims require comparable measurements and equivalent output.
- For GitHub Actions edits, use `optimize-github-actions` in `.agents/skills/`.
  Preserve required coverage; never run untrusted PR code on self-hosted runners.
<!-- END KF AGENT POLICY -->

# Repository instructions

Read [README](README.md) for the public-data boundary, then
[DEVELOPMENT.md](DEVELOPMENT.md#choosing-local-checks) for change-specific checks.
Run commands in this repository's root with Node 24.15 or newer within 24.x,
npm and Python 3:
`npm ci`, `npm run check`; preview with `npm run serve` at
`http://localhost:4173/` and stop it after use. Checks need no Google login.
Individual stages are `npm run lint`, `npm run validate:html`,
`npm run validate:site` and `npm test`. Lint checks JavaScript syntax, not style;
there is no separate type-check command or build step.

Start with the affected `docs/*.html` and its `docs/assets/*.js`; `app.js` renders
schedule data and `attendance.js` owns historical totals/TSV export. Read the
public-data policy before changing `docs/data/` or any exported fields. Counts
represent Form responses, not confirmed physical attendance. Preserve payload
status/null semantics, TSV compatibility, Japanese/English agreement and the
intentionally blank anonymous JSONP endpoint.

`docs/data/public.json` is automation-maintained published data, not a scratch
fixture. Use in-memory test data for experiments. Keep private operational IDs,
credentials, local settings, `node_modules/` and `build/` out of changes. Apps
Script source and production operations belong in the separate private repo.

Run the affected checks while iterating and full `npm run check` before push.
Review changed pages at desktop and narrow widths when markup/style/rendering
changes. Report commands/results, omitted checks and browser/live limitations;
check `git diff --check` and the final diff. Keep `VERSION`, package and lockfile
root versions aligned for push. Pushing `main` triggers CI and then Pages;
it does not deploy Apps Script. See DEVELOPMENT for recovery, not routine setup.
