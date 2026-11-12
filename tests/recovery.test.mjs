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
  const publishable = "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'";
  assert.match(ci, /run: npm run check\n\n      - name: Upload validated Pages files/);
  assert.ok(ci.includes(`- name: Upload validated Pages files\n        if: ${publishable}`));
  assert.match(ci, /path: docs/);
  assert.match(ci, /needs: validate-site/);
  assert.ok(ci.includes(`needs: validate-site\n    if: ${publishable}`));
  assert.match(ci, /PAGES_ARTIFACT_NAME: github-pages-\$\{\{ github\.run_attempt \}\}/);
  assert.match(ci, /artifact-name: \$\{\{ needs\.validate-site\.outputs\.pages-artifact \}\}/);
  assert.match(pages, /workflow_call:/);
  assert.doesNotMatch(pages, /workflow_dispatch:|push:|npm ci|actions\/checkout|actions\/upload-pages-artifact/);
  assert.match(pages, /artifact_name: \$\{\{ inputs\.artifact-name \}\}/);
  assert.match(recovery, /head_repository\.full_name == github\.repository/);
  assert.match(recovery, /ref: main/);
});

test("Pages waits for one visible artifact and skips delay when it is already available", () => {
  const pages = fs.readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const waitScript = pages.match(/        run: \|\n((?: {10}[^\n]*\n)+)\n      - name: Deploy/)?.[1];
  assert.ok(waitScript, "artifact check must run before deployment");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nig-pages-artifact-"));
  try {
    fs.writeFileSync(path.join(directory, "gh"), `#!/usr/bin/env bash
set -eu
[[ "$1 $2 $3 $4 $5 $6 $7" == "api --method GET repos/fixture/site/actions/runs/123/artifacts -f name=github-pages-2 --jq" ]]
index=0
if [[ -f "$FIXTURE_DIR/lookups" ]]; then
  read -r index < "$FIXTURE_DIR/lookups"
fi
printf '%s\\n' "$((index + 1))" > "$FIXTURE_DIR/lookups"
response="$(sed -n "$((index + 1))p" "$FIXTURE_DIR/responses")"
[[ "$response" != error ]] || exit 1
jq -r "$8" <<<"$response"
`, { mode: 0o755 });
    fs.writeFileSync(path.join(directory, "sleep"), `#!/usr/bin/env bash
printf '%s\\n' "$1" >> "$FIXTURE_DIR/delays"
`, { mode: 0o755 });
    const available = { total_count: 1, artifacts: [{ expired: false }] };
    const expired = { total_count: 1, artifacts: [{ expired: true }] };
    const duplicate = { total_count: 2, artifacts: [available.artifacts[0], available.artifacts[0]] };
    const missing = { total_count: 0, artifacts: [] };
    for (const [responses, delays, status] of [
      [[available], [], 0],
      [[missing, "error", available], [1, 2], 0],
      [[missing, expired, duplicate, "error", missing], [1, 2, 4, 8], 1],
    ]) {
      const lookups = path.join(directory, "lookups");
      const delayLog = path.join(directory, "delays");
      fs.rmSync(lookups, { force: true });
      fs.rmSync(delayLog, { force: true });
      fs.writeFileSync(path.join(directory, "responses"), responses.map(response =>
        response === "error" ? response : JSON.stringify(response)).join("\n") + "\n");
      const result = spawnSync("bash", ["-euo", "pipefail", "-c", waitScript], {
        encoding: "utf8", timeout: 10000,
        env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, FIXTURE_DIR: directory,
          GITHUB_REPOSITORY: "fixture/site", GITHUB_RUN_ID: "123", PAGES_ARTIFACT_NAME: "github-pages-2" },
      });
      assert.equal(result.status, status, result.stderr);
      assert.equal(Number(fs.readFileSync(lookups, "utf8")), responses.length);
      const actualDelays = fs.existsSync(delayLog) ? fs.readFileSync(delayLog, "utf8").trim().split("\n").map(Number) : [];
      assert.deepEqual(actualDelays, delays);
      if (status) assert.match(result.stdout, /::error::Expected one visible, unexpired github-pages-2 artifact for run 123/);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
