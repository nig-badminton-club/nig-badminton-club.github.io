import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("the check entrypoint waits for every stage and preserves a failed stage", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nig-check-"));
  try {
    const cli = path.join(directory, "npm.mjs");
    fs.writeFileSync(cli, `import fs from "node:fs";
const stage = process.argv[3];
fs.writeFileSync(new URL(stage.replaceAll(":", "-") + ".ran", import.meta.url), "done");
console.log("Completed " + stage);
process.exitCode = stage === process.env.CHECK_FIXTURE_FAILURE ? 2 : 0;
`);
    for (const failure of ["", "validate:html"]) {
      for (const name of fs.readdirSync(directory).filter(name => name.endsWith(".ran"))) fs.unlinkSync(path.join(directory, name));
      const result = spawnSync(process.execPath, ["scripts/check.mjs"], {
        encoding: "utf8", timeout: 10000,
        env: { ...process.env, npm_execpath: cli, CHECK_FIXTURE_FAILURE: failure },
      });
      assert.equal(result.status, failure ? 1 : 0, result.stderr);
      for (const stage of ["lint", "validate:html", "validate:site", "test"]) {
        assert.ok(fs.existsSync(path.join(directory, `${stage.replaceAll(":", "-")}.ran`)));
        assert.match(result.stdout, new RegExp(`Completed ${stage}`));
      }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
