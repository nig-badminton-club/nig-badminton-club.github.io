import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import axe from "axe-core";
import { JSDOM } from "jsdom";

const docsUrl = new URL("../docs/", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, docsUrl), "utf8");
}

async function renderPage(htmlPath, scriptPath, data) {
  const dom = new JSDOM(read(htmlPath), {
    runScripts: "outside-only",
    url: `https://nig-badminton-club.github.io/${htmlPath}`,
  });
  dom.window.NIG_BADMINTON_PUBLIC_JSONP_URL = "";
  dom.window.fetch = async () => ({ json: async () => structuredClone(data) });
  dom.window.eval(read(scriptPath));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));
  return dom;
}

const baseData = JSON.parse(read("data/public.json"));

test("future practices show an opening state instead of unanswered member counts", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "2099-07-17",
    date: "2099-07-17",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "upcoming",
    attendingCount: null,
    absentCount: null,
    unansweredCount: null,
    guestCount: null,
    publicNote: "",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const card = dom.window.document.querySelector(".session-card");
  assert.match(card.textContent, /attendance form opens during the week of the practice/i);
  assert.doesNotMatch(card.textContent, /no response \/ 未回答/);
  assert.equal(card.querySelector(".counts"), null);
});

test("closed practices show counts without an attendance form link or role identity", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "2099-07-10",
    date: "2099-07-10",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "closed",
    attendingCount: 12,
    absentCount: 3,
    unansweredCount: 2,
    guestCount: 1,
    roleStatus: "assigned",
    roles: "Setup: private.person",
    publicNote: "Bring water / 飲み物持参",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const card = dom.window.document.querySelector(".session-card");
  assert.match(card.textContent, /12/);
  assert.match(card.textContent, /attendance form is closed/i);
  assert.doesNotMatch(card.textContent, /private\.person/);
  assert.equal(card.querySelector("a.session-form-link"), null);
});

test("stale public data produces a visible warning", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = "2020-01-01T00:00:00+09:00";
  data.sessions = [];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const banner = dom.window.document.getElementById("data-health");
  assert.equal(banner.hidden, false);
  assert.match(banner.textContent, /may not have the latest data/);
});

test("participation information explains the current and possible future fee", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.policy.fees = "There is currently no participation fee. A fee of a few hundred yen per practice may be introduced in the future. / 現在、参加費は徴収していません。将来は練習1回につき数百円程度の参加費をお願いする可能性があります。";
  const dom = await renderPage("index.html", "assets/app.js", data);
  const policy = dom.window.document.getElementById("policy-content");
  assert.match(policy.textContent, /currently no participation fee/);
  assert.match(policy.textContent, /現在、参加費は徴収していません/);
});

test("membership form opens as a separate signed-in Google flow", async () => {
  const data = structuredClone(baseData);
  const dom = await renderPage("join.html", "assets/join.js", data);
  const link = dom.window.document.getElementById("membership-form-link");
  assert.equal(link.target, "_blank");
  assert.match(link.href, /^https:\/\/docs\.google\.com\/forms\//);
  assert.equal(dom.window.document.querySelector(".embedded-form-wrap"), null);
  assert.match(dom.window.document.getElementById("membership-status").textContent, /Google sign-in is required/);
});

test("public HTML does not expose administrator account IDs or private spreadsheet URLs", () => {
  const html = fs.readdirSync(docsUrl)
    .filter((name) => name.endsWith(".html"))
    .map((name) => read(name))
    .join("\n");
  assert.doesNotMatch(html, /kenji\.fukushima|nyamatan/);
  assert.doesNotMatch(html, /spreadsheets\/d\//);
});

test("rendered public pages have no detectable structural accessibility violations", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  const pages = [
    ["index.html", "assets/app.js"],
    ["about.html", "assets/app.js"],
    ["join.html", "assets/join.js"],
  ];
  for (const [htmlPath, scriptPath] of pages) {
    const dom = await renderPage(htmlPath, scriptPath, data);
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    assert.equal(
      results.violations.length,
      0,
      `${htmlPath}: ${results.violations.map((violation) => `${violation.id} (${violation.nodes.length})`).join(", ")}`,
    );
  }
});
