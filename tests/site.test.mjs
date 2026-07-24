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
    keyPickupStatus: "awaiting-assignment",
    publicNote: "",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const card = dom.window.document.querySelector(".session-card");
  assert.match(card.textContent, /attendance form opens during the week of the practice/i);
  assert.doesNotMatch(card.textContent, /no response \/ 未回答/);
  assert.equal(card.querySelector(".counts"), null);
  assert.match(card.querySelector(".key-pickup-status").textContent, /準備担当の確定前/);
});

test("practice dates use only the Japanese date format", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "2099-07-24",
    date: "2099-07-24",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "upcoming",
    keyPickupStatus: "awaiting-assignment",
    publicNote: "",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const document = dom.window.document;

  assert.match(document.getElementById("next-session-title").textContent, /^2099\/7\/24\(金\) 19:00-21:00$/);
  assert.equal(document.querySelector(".session-date").textContent, "2099/7/24(金)");
  assert.doesNotMatch(document.body.textContent, /Fri, Jul 24, 2099/);
});

test("only the nearest four practices show details and later practices show dates only", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = ["07-24", "07-31", "08-07", "08-14", "08-21", "08-28"].map((monthDay) => ({
    sessionId: `2099-${monthDay}`,
    date: `2099-${monthDay}`,
    time: "19:00-21:00",
    reservationTime: "18:00-21:30",
    reservationStatus: "provisional",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "upcoming",
    keyPickupStatus: "awaiting-assignment",
    publicNote: "",
    formUrl: "",
  }));
  const dom = await renderPage("index.html", "assets/app.js", data);
  const document = dom.window.document;
  const detailedCards = document.querySelectorAll(".session-card");
  const laterDates = document.querySelectorAll(".session-date-item");
  const laterList = document.querySelector(".session-date-list");

  assert.equal(detailedCards.length, 4);
  assert.equal(laterDates.length, 2);
  assert.equal(laterDates[0].textContent, "2099/8/21(金)");
  assert.equal(laterDates[1].textContent, "2099/8/28(金)");
  assert.doesNotMatch(laterList.textContent, /19:00|18:00|仮予約|体育館/);
});

test("practice time and municipal gym reservation time are shown separately without private references", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "2099-07-17",
    date: "2099-07-17",
    time: "19:00-21:00",
    reservationTime: "18:00-21:30",
    reservationStatus: "provisional",
    reservationReference: "PRIVATE-TEST-REFERENCE",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "upcoming",
    attendingCount: null,
    absentCount: null,
    unansweredCount: null,
    guestCount: null,
    keyPickupStatus: "awaiting-assignment",
    publicNote: "",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const card = dom.window.document.querySelector(".session-card");
  const nextReservation = dom.window.document.getElementById("next-session-reservation");

  assert.match(card.textContent, /Practice \/ 練習: 19:00-21:00/);
  assert.match(card.textContent, /Gym reserved \/ 体育館予約: 18:00-21:30/);
  assert.match(card.textContent, /Provisional \/ 仮予約/);
  assert.match(nextReservation.textContent, /18:00-21:30/);
  assert.equal(nextReservation.hidden, false);
  assert.doesNotMatch(dom.window.document.body.textContent, /PRIVATE-TEST-REFERENCE/);
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
    keyPickupStatus: "confirmed",
    roles: "Setup: private.person",
    publicNote: "Bring water / 飲み物持参",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const card = dom.window.document.querySelector(".session-card");
  assert.match(card.textContent, /12/);
  assert.match(card.textContent, /self-service attendance changes are closed/i);
  assert.doesNotMatch(card.textContent, /private\.person/);
  assert.match(card.querySelector(".key-pickup-confirmed").textContent, /受け取り済み/);
  assert.equal(card.querySelector("a.session-form-link"), null);
});

test("key pickup state changes from pending to confirmed without exposing identities", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "2099-07-17",
    date: "2099-07-17",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "changes-open",
    attendingCount: 12,
    absentCount: 3,
    unansweredCount: 2,
    guestCount: 1,
    roleStatus: "assigned",
    keyPickupStatus: "pending",
    publicNote: "",
    formUrl: "",
  }];
  const pendingDom = await renderPage("index.html", "assets/app.js", data);
  const pending = pendingDom.window.document.querySelector(".key-pickup-status");
  assert.match(pending.textContent, /Not yet confirmed/);
  assert.match(pending.textContent, /未確認/);

  data.sessions[0].keyPickupStatus = "confirmed";
  const confirmedDom = await renderPage("index.html", "assets/app.js", data);
  const confirmed = confirmedDom.window.document.querySelector(".key-pickup-status");
  assert.match(confirmed.textContent, /Confirmed/);
  assert.match(confirmed.textContent, /受け取り済み/);
  assert.doesNotMatch(confirmed.textContent, /@|token|assignee/i);
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
  assert.match(card.textContent, /できるだけ締切前にご回答いただけるよう、ご本人へご案内メールをお送りします/);
  assert.doesNotMatch(card.textContent, /注意メール/);
  assert.equal(link.href, "https://docs.google.com/forms/d/e/example/viewform");
});

test("workflow and role pages explain the Thursday role-candidate snapshot", () => {
  const workflow = read("workflow.html");
  const roles = read("role-assignment.html");
  assert.match(workflow, /latest response received before 17:00 fixes the role-candidate pool/i);
  assert.match(workflow, /自動担当選出の対象には含めません/);
  assert.match(workflow, /ご本人へご案内メールをお送りします/);
  assert.doesNotMatch(workflow, /注意メール/);
  assert.match(roles, /Deadline snapshot/);
  assert.match(roles, /締切後の新しい参加登録も出欠には反映/);
  assert.doesNotMatch(workflow, /引き受けられるかどうかもご検討/);
});

test("workflow explains manual booking and automatic website publication without duplicating it on the schedule", () => {
  const index = new JSDOM(read("index.html")).window.document;
  const workflow = new JSDOM(read("workflow.html")).window.document;
  const reservationSection = workflow.querySelector('[aria-labelledby="facility-reservation-title"]');

  assert.equal(index.querySelector(".schedule-sync-note"), null);
  assert.doesNotMatch(index.body.textContent, /Gym reservations are made manually by a club administrator/);
  assert.ok(reservationSection);
  assert.match(reservationSection.textContent, /does not make, change, or cancel municipal reservations/i);
  assert.match(reservationSection.textContent, /自動処理で予約情報を定期的に確認します/);
  assert.doesNotMatch(reservationSection.textContent, /読み取り専用の動作|応答全体を検証/);
  assert.match(reservationSection.textContent, /管理スプレッドシートへ保存/);
  assert.match(reservationSection.textContent, /施設予約時間と部の練習時間は、別の情報/);
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
  const stepLabels = Array.from(section.querySelectorAll(".step-time"), (element) => element.textContent.trim());
  assert.deepEqual(stepLabels.slice(0, 2), [
    "Open the Form / フォームを開く",
    "Submit Again / 再回答する",
  ]);
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

test("attendance trends combine attending members and guests across yearly series", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [
    {
      sessionId: "2025-07-11",
      date: "2025-07-11",
      status: "scheduled",
      attendingCount: 8,
      guestCount: 1,
    },
    {
      sessionId: "2026-07-17",
      date: "2026-07-17",
      status: "scheduled",
      attendingCount: 10,
      guestCount: 3,
    },
    {
      sessionId: "2099-07-24",
      date: "2099-07-24",
      status: "scheduled",
      attendingCount: 4,
      guestCount: 1,
    },
  ];
  const dom = await renderPage("attendance.html", "assets/attendance.js", data);
  const document = dom.window.document;
  assert.equal(document.getElementById("recorded-session-count").textContent, "2");
  assert.equal(document.getElementById("recorded-year-range").textContent, "2025–2026");
  assert.equal(document.getElementById("latest-attendance-total"), null);
  assert.match(document.getElementById("attendance-legend").textContent, /2025/);
  assert.match(document.getElementById("attendance-legend").textContent, /2026/);
  const rows = Array.from(document.querySelectorAll("#attendance-records-body tr"));
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /13/);
  assert.match(rows[0].textContent, /2026\/7\/17/);
  assert.doesNotMatch(rows[0].textContent, /Jul 17, 2026/);
  assert.match(rows[1].textContent, /9/);
  const download = document.getElementById("attendance-download");
  assert.equal(download.getAttribute("download"), "nig-badminton-attendance.tsv");
  const tsv = decodeURIComponent(download.href.split(",")[1]);
  assert.match(tsv, /date\tattending_count\tguest_count\ttotal_participants/);
  assert.match(tsv, /2025-07-11\t8\t1\t9/);
  assert.match(tsv, /2026-07-17\t10\t3\t13/);
});

test("attendance table shows only the latest 20 practices while TSV keeps all records", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = Array.from({ length: 21 }, (_, index) => ({
    sessionId: `2026-01-${String(index + 1).padStart(2, "0")}`,
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    status: "scheduled",
    attendingCount: index + 1,
    guestCount: 0,
  }));
  const dom = await renderPage("attendance.html", "assets/attendance.js", data);
  const document = dom.window.document;
  const visibleRows = Array.from(document.querySelectorAll("#attendance-records-body tr"));
  assert.equal(visibleRows.length, 20);
  assert.match(visibleRows[0].textContent, /2026\/1\/21/);
  assert.match(visibleRows[19].textContent, /2026\/1\/2/);
  const download = document.getElementById("attendance-download");
  const tsv = decodeURIComponent(download.href.split(",")[1]);
  assert.match(tsv, /2026-01-01\t1\t0\t1/);
  assert.match(tsv, /2026-01-21\t21\t0\t21/);
  assert.equal(tsv.split("\r\n").filter(Boolean).length, 22);
});

test("attendance chart uses English month labels without point value text", () => {
  const script = read("assets/attendance.js");
  assert.match(script, /const monthLabels = \["Jan", "Feb", "Mar"/);
  assert.doesNotMatch(script, /fillText\(`\$\{point\.total\}人`/);
});

test("public data freshness warning follows the weekly heartbeat", async () => {
  const freshData = structuredClone(baseData);
  freshData.generatedAt = new Date(Date.now() - (7 * 24 * 60 - 1) * 60 * 1000).toISOString();
  const freshDom = await renderPage("attendance.html", "assets/attendance.js", freshData);
  assert.equal(freshDom.window.document.getElementById("data-health").hidden, true);

  const staleData = structuredClone(baseData);
  staleData.generatedAt = new Date(Date.now() - (7 * 24 * 60 + 20) * 60 * 1000).toISOString();
  const staleDom = await renderPage("attendance.html", "assets/attendance.js", staleData);
  assert.equal(staleDom.window.document.getElementById("data-health").hidden, false);
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
    ["attendance.html", "assets/attendance.js"],
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
