import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

function recover(config) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nig-pages-recovery-"));
  try {
    fs.writeFileSync(path.join(directory, "fixture.json"), JSON.stringify(config));
    fs.writeFileSync(path.join(directory, "gh"), `#!/usr/bin/env node
const fs = require('node:fs');
const dir = process.env.FIXTURE_DIR;
const config = JSON.parse(fs.readFileSync(dir + '/fixture.json'));
const args = process.argv.slice(2);
if (args[0] === 'api') {
  if (config.apiFails) process.exit(1);
  if (args[1].includes('/git/ref/')) {
    const counter = dir + '/head-reads';
    const count = fs.existsSync(counter) ? Number(fs.readFileSync(counter)) : 0;
    fs.writeFileSync(counter, String(count + 1));
    console.log(count && config.nextHead ? config.nextHead : 'current-head');
  } else {
    if (!args[1].includes('head_sha=current-head')) process.exit(2);
    console.log(JSON.stringify({ workflow_runs: config.runs || [] }));
  }
} else if (args[0] === 'workflow' && args[1] === 'run') {
  fs.writeFileSync(dir + '/dispatch.json', JSON.stringify(args));
} else process.exit(2);
`, { mode: 0o755 });
    fs.writeFileSync(path.join(directory, "sleep"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
    const result = spawnSync("bash", ["scripts/recover_pages.sh"], {
      encoding: "utf8", timeout: 10000,
      env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, FIXTURE_DIR: directory,
        GH_REPO: "fixture/site", GH_TOKEN: "fixture", DEPLOY_WORKFLOW: "ci.yml", DEFAULT_BRANCH: "main", MAX_RECOVERY_RUNS: "3" },
    });
    const dispatch = path.join(directory, "dispatch.json");
    return { ...result, dispatch: fs.existsSync(dispatch) ? JSON.parse(fs.readFileSync(dispatch)) : null };
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
  assert.equal((`${ci}\n${pages}`.match(/npm run check/g) || []).length, 1);
  assert.match(ci, /needs: validate-site/);
  assert.match(ci, /github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/);
  assert.match(pages, /workflow_call:/);
  assert.doesNotMatch(pages, /workflow_dispatch:|push:|npm ci/);
  assert.match(pages, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(recovery, /head_repository\.full_name == github\.repository/);
  assert.match(recovery, /ref: main/);
  assert.match(recovery, /17 \*\/6 \* \* \*/);
});
