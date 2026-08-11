import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const repositoryUrl = new URL("../", import.meta.url);

test("Pages recovery uses the lightweight hosted runner pool", () => {
  const workflow = fs.readFileSync(
    new URL(".github/workflows/pages-recovery.yml", repositoryUrl),
    "utf8",
  );

  assert.match(workflow, /^\s*runs-on: ubuntu-slim$/m);
  assert.match(workflow, /^\s*timeout-minutes: 5$/m);
});
