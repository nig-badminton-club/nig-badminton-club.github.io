import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const baselineRef = process.argv[2] || "5fa30a77144e1e82fceafd7c9790f8b8a34852bb";
const before = execFileSync("git", ["show", `${baselineRef}:docs/assets/app.js`], { encoding: "utf8" });
const after = fs.readFileSync("docs/assets/app.js", "utf8");
const html = fs.readFileSync("docs/index.html", "utf8");
const data = JSON.parse(fs.readFileSync("docs/data/public.json", "utf8"));
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const repetitions = 20;

function compileFormatter(source) {
  const start = source.indexOf("  function formatDate(");
  assert.notEqual(start, -1, "Practice-date formatter is missing");
  const end = source.indexOf("\n  function ", start + 1);
  const cached = source.match(/^  const practiceDateFormatter = [\s\S]+?^  \}\);/m)?.[0]
    || source.match(/^  let practiceDateFormatter;/m)?.[0] || "";
  return new vm.Script(`(() => { ${cached}\n${source.slice(start, end)}\nreturn formatDate; })()`);
}
const formatters = { before: compileFormatter(before), after: compileFormatter(after) };
const context = vm.createContext({ Date, Intl });

function measure(compiled, sessions) {
  const dates = [sessions[1].date, ...sessions.map(session => session.date)];
  let output;
  // Optional collection between batches limits benchmark-only native Intl
  // allocations; it is outside the timed page-formatting workload.
  globalThis.gc?.();
  const started = performance.now();
  for (let i = 0; i < repetitions; i++) {
    // Include the formatter initialization once per simulated page load.
    const formatDate = compiled.runInContext(context);
    output = dates.map(formatDate);
  }
  return { ms: (performance.now() - started) / repetitions, output };
}

async function render(source, sessions) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/" });
  try {
    dom.window.fetch = async () => ({ ok: true, json: async () => ({ ...data, sessions }) });
    dom.window.eval(fs.readFileSync("docs/assets/public-data.js", "utf8"));
    dom.window.eval(source);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dom.window.document.querySelectorAll(".session-card").length, 4);
    return dom.window.document.body.innerHTML;
  } finally { dom.window.close(); }
}

const workloads = [];
for (const size of [12, 52, 260]) {
  const sessions = Array.from({ length: size }, (_, i) => {
    const date = new Date(Date.UTC(2090, 0, 6 + i * 7)).toISOString().slice(0, 10);
    return { sessionId: date, date, time: "19:00-21:00", location: "Gym / 体育館",
      status: i % 7 === 0 ? "cancelled" : "scheduled", responseStatus: i % 7 === 0 ? "cancelled" : "upcoming" };
  });
  assert.equal(await render(before, sessions), await render(after, sessions));
  assert.deepEqual(measure(formatters.before, sessions).output, measure(formatters.after, sessions).output);
  const trials = [];
  for (let trial = 0; trial < 5; trial++) {
    const pair = {};
    for (const name of trial % 2 ? ["after", "before"] : ["before", "after"]) {
      pair[name] = measure(formatters[name], sessions);
    }
    assert.deepEqual(pair.before.output, pair.after.output);
    trials.push({ beforeMs: pair.before.ms, afterMs: pair.after.ms });
  }
  workloads.push({ sessions: size, pagesPerTrial: repetitions, trials, medianBeforeMs: median(trials.map(row => row.beforeMs)),
    medianAfterMs: median(trials.map(row => row.afterMs)) });
}
console.log(JSON.stringify({ baselineRef, node: process.version, platform: `${process.platform}/${process.arch}`,
  scope: "CPU-only practice-date formatting per page including initialization; next practice plus all dates; identical strings and full jsdom HTML; excludes network and browser layout",
  peakRssKiB: process.resourceUsage().maxRSS, workloads }, null, 2));
