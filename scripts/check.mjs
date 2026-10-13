import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run these checks with npm run check.");

// These stages read repository files and use isolated temporary fixtures.
// Complete every stage, including after a failure, and report all diagnostics.
const results = await Promise.all(["lint", "validate:html", "validate:site", "test"].map(stage => new Promise(resolve => {
  const child = spawn(process.execPath, [npmCli, "run", stage], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
  child.stderr.setEncoding("utf8").on("data", chunk => { output += chunk; });
  child.on("error", error => { output += `${error.message}\n`; });
  child.on("close", code => resolve({ code, output }));
})));

for (const result of results) process.stdout.write(result.output);
process.exitCode = results.some(result => result.code !== 0) ? 1 : 0;
