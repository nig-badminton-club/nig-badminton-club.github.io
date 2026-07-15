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
  assert.match(card.textContent, /self-service attendance changes are closed/i);
  assert.doesNotMatch(card.textContent, /private\.person/);
  assert.equal(card.querySelector("a.session-form-link"), null);
});

test("post-assignment change window keeps the update form visible", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "2099-07-10",
    date: "2099-07-10",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "changes-open",
    attendingCount: 12,
    absentCount: 3,
    unansweredCount: 2,
    guestCount: 1,
    roleStatus: "assigned",
    publicNote: "",
    formUrl: "https://docs.google.com/forms/d/e/example/viewform",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const card = dom.window.document.querySelector(".session-card");
  const link = card.querySelector("a.session-form-link");
  assert.match(card.textContent, /update attendance/i);
  assert.match(card.textContent, /30 minutes before practice/i);
  assert.match(card.textContent, /not included in automatic role selection/i);
  assert.match(card.textContent, /本人へ注意メールを送ります/);
  assert.equal(link.href, "https://docs.google.com/forms/d/e/example/viewform");
});

test("workflow and role pages explain the Thursday role-candidate snapshot", () => {
  const workflow = read("workflow.html");
  const roles = read("role-assignment.html");
  assert.match(workflow, /latest response received before 17:00 fixes the role-candidate pool/i);
  assert.match(workflow, /自動担当選出の対象には含めず/);
  assert.match(roles, /Deadline snapshot/);
  assert.match(roles, /締切後の新しい参加登録も出欠には反映/);
  assert.doesNotMatch(workflow, /引き受けられるかどうかもご検討/);
});

test("workflow has a dedicated attendance-change procedure", () => {
  const dom = new JSDOM(read("workflow.html"));
  const section = dom.window.document.querySelector('[aria-labelledby="attendance-change-title"]');
  assert.ok(section);
  assert.match(section.querySelector("h2").textContent, /出欠を後から変更する方法/);
  assert.match(section.textContent, /前回の回答と同じGoogleアカウント/);
  assert.match(section.textContent, /変更後の予定を入力し、フォームをもう一度送信/);
  assert.match(section.textContent, /練習開始30分前/);
  assert.match(section.textContent, /Google Groupへ直接メール/);
  assert.match(section.textContent, /代役を募集し、引き継ぎを確定/);
});

test("invalid date text from public data is rendered as text, not markup", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "invalid-date",
    date: "zz<img src=x onerror=alert(1)>",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "open",
    attendingCount: 0,
    absentCount: 0,
    unansweredCount: 0,
    guestCount: 0,
    publicNote: "",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const date = dom.window.document.querySelector(".session-date");
  assert.equal(date.querySelector("img"), null);
  assert.match(date.textContent, /<img src=x onerror=alert\(1\)>/);
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
