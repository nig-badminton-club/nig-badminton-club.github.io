import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

function recover(config) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nig-pages-recovery-"));
  try {
    fs.writeFileSync(path.join(directory, "runs.json"), JSON.stringify({ workflow_runs: config.runs || [] }));
    // Exercise the real recovery shell and jq filters without starting Node for
    // each fake API response or dispatch.
    fs.writeFileSync(path.join(directory, "gh"), `#!/usr/bin/env bash
set -eu
if [[ "$1" == api ]]; then
  [[ "$FIXTURE_API_FAILS" == 0 ]] || exit 1
  if [[ "$2" == */git/ref/* ]]; then
    if [[ -f "$FIXTURE_DIR/head-read" ]]; then
      printf '%s\\n' "$FIXTURE_NEXT_HEAD"
    else
      printf 'current-head\\n'
    fi
    : > "$FIXTURE_DIR/head-read"
  else
    [[ "$2" == *head_sha=current-head* ]] || exit 2
    cat "$FIXTURE_DIR/runs.json"
  fi
elif [[ "$1" == workflow && "$2" == run ]]; then
  printf '%s\\n' "$@" > "$FIXTURE_DIR/dispatch"
else
  exit 2
fi
`, { mode: 0o755 });
    fs.writeFileSync(path.join(directory, "sleep"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    const result = spawnSync("bash", ["scripts/recover_pages.sh"], {
      encoding: "utf8", timeout: 10000,
      env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, FIXTURE_DIR: directory,
        FIXTURE_API_FAILS: config.apiFails ? "1" : "0", FIXTURE_NEXT_HEAD: config.nextHead || "current-head",
        GH_REPO: "fixture/site", GH_TOKEN: "fixture", DEPLOY_WORKFLOW: "ci.yml", DEFAULT_BRANCH: "main", MAX_RECOVERY_RUNS: "3" },
    });
    const dispatch = path.join(directory, "dispatch");
    return { ...result, dispatch: fs.existsSync(dispatch) ? fs.readFileSync(dispatch, "utf8").trim().split("\n") : null };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
const run = (overrides = {}) => ({ head_sha: "current-head", status: "completed", conclusion: "failure", event: "push", ...overrides });

for (const [name, runs] of [
  ["already successful", [run({ conclusion: "success" })]],
  ["already active", [run({ status: "in_progress", conclusion: null })]],
  ["retry limit reached", Array.from({ length: 3 }, () => run({ event: "workflow_dispatch" }))],
]) {
  test(`Pages recovery does not dispatch when ${name}`, () => {
    const result = recover({ runs });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.dispatch, null);
  });
}
test("a failed or missing Pages run dispatches the single CI-to-deploy workflow", () => {
  for (const runs of [[], [run()]]) {
    const result = recover({ runs });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.dispatch, ["workflow", "run", "ci.yml", "--ref", "main"]);
  }
});
test("an advancing main branch is not dispatched from a stale recovery decision", () => {
  const result = recover({ runs: [run()], nextHead: "new-head" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.dispatch, null);
});
test("GitHub API failures cannot be mistaken for a missing deployment", () => {
  const result = recover({ apiFails: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.dispatch, null);
});
test("a validation-only pull request cannot be mistaken for a successful Pages deployment", () => {
  const result = recover({ runs: [run({ event: "pull_request", conclusion: "success" })] });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.dispatch);
});
test("only successful validation of the same commit can enter the Pages workflow", () => {
  const ci = fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const pages = fs.readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const recovery = fs.readFileSync(new URL("../.github/workflows/pages-recovery.yml", import.meta.url), "utf8");
  assert.match(ci, /needs: validate-site/);
  assert.match(ci, /github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/);
  assert.match(pages, /workflow_call:/);
  assert.doesNotMatch(pages, /workflow_dispatch:|push:|npm ci/);
  assert.match(pages, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(recovery, /head_repository\.full_name == github\.repository/);
  assert.match(recovery, /ref: main/);
});
