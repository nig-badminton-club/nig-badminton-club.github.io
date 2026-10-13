import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import axe from "axe-core";
import { JSDOM } from "jsdom";

const docsUrl = new URL("../docs/", import.meta.url);
const openWindows = new Set();
test.afterEach(() => {
  openWindows.forEach(window => window.close());
  openWindows.clear();
});

function read(path) {
  return fs.readFileSync(new URL(path, docsUrl), "utf8");
}

function close(dom) {
  dom.window.close();
  openWindows.delete(dom.window);
}

async function renderPage(htmlPath, scriptPath, data, configure = () => {}) {
  const dom = new JSDOM(read(htmlPath), {
    runScripts: "outside-only",
    url: `https://nig-badminton-club.github.io/${htmlPath}`,
  });
  openWindows.add(dom.window);
  dom.window.NIG_BADMINTON_PUBLIC_JSONP_URL = "";
  dom.window.fetch = async () => ({ ok: true, json: async () => structuredClone(data) });
  configure(dom.window);
  if (!scriptPath) {
    await new Promise((resolve) => dom.window.document.addEventListener("DOMContentLoaded", resolve, { once: true }));
    return dom;
  }
  // These scripts render synchronously when their data promise settles. Wait
  // for that DOM update, including error rendering and JSONP fallback.
  const rendered = new Promise((resolve, reject) => {
    const observer = new dom.window.MutationObserver(() => {
      observer.disconnect();
      dom.window.clearTimeout(timeout);
      resolve();
    });
    const timeout = dom.window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`${htmlPath} did not render`));
    }, 1000);
    observer.observe(dom.window.document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  });
  dom.window.eval(read(scriptPath));
  await rendered;
  return dom;
}

const baseData = JSON.parse(read("data/public.json"));

test("next practice skips finished, cancelled and invalid dates and never reopens a stale form", async () => {
  const formUrl = "https://docs.google.com/forms/d/e/example/viewform";
  const data = { ...baseData, sessions: [
    { sessionId: "2026-10-09", date: "2026-10-09", time: "19:00-21:00", status: "scheduled", responseStatus: "closed", formUrl },
    { sessionId: "2026-10-10", date: "2026-10-10", status: "scheduled", responseStatus: "cancelled", formUrl },
    { sessionId: "2026-10-11", date: "2026-10-11", status: "cancelled", responseStatus: "open", formUrl },
    { sessionId: "2026-10-12", date: "2026-10-12", status: "scheduled", responseStatus: "upcoming", formUrl },
    { sessionId: "2099-02-30", date: "2099-02-30", status: "scheduled", responseStatus: "open", formUrl },
  ] };
  const dom = await renderPage("index.html", "assets/app.js", data, window => {
    const OriginalDate = window.Date;
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : ["2026-10-09T13:00:00Z"])); }
      static now() { return new OriginalDate("2026-10-09T13:00:00Z").getTime(); }
    };
  });
  const document = dom.window.document;
  assert.match(document.getElementById("next-session-title").textContent, /2026\/10\/12/);
  assert.equal(document.getElementById("next-session-form").hasAttribute("href"), false);
  assert.equal(document.querySelectorAll(".session-card").length, 4);
  assert.equal(document.querySelectorAll(".session-form-link[href]").length, 0);
  for (const card of [...document.querySelectorAll(".session-card")].slice(1, 3)) {
    assert.match(card.querySelector(".status").textContent, /Cancelled/);
    assert.equal(card.querySelector(".counts"), null);
  }
});

for (const [page, script, target, errorText] of [
  ["index.html", "assets/app.js", "next-session-title", /schedule unavailable/i],
  ["attendance.html", "assets/attendance.js", "attendance-empty", /could not be loaded/i],
  ["join.html", "assets/join.js", "membership-status", /currently unavailable/i],
]) {
  test(`${page} rejects HTTP errors even when their bodies are valid JSON`, async () => {
    const dom = await renderPage(page, script, baseData, window => {
      window.console.error = () => {};
      window.fetch = async () => ({ ok: false, status: 503, json: async () => structuredClone(baseData) });
    });
    assert.match(dom.window.document.getElementById(target).textContent, errorText);
    if (page === "attendance.html") {
      assert.match(dom.window.document.getElementById("cancelled-records-body").textContent, /could not be loaded/);
    }
  });

  test(`${page} rejects a malformed sessions list`, async () => {
    const dom = await renderPage(page, script, { ...baseData, sessions: [null] }, window => {
      window.console.error = () => {};
    });
    assert.match(dom.window.document.getElementById(target).textContent, errorText);
  });

  test(`${page} tries configured JSONP first and falls back only on failure`, async () => {
    for (const failure of [null, "error", "timeout"]) {
      let fetches = 0;
      let jsonpRequests = 0;
      const dom = await renderPage(page, script, baseData, window => {
        window.console.warn = () => {};
        window.console.error = () => {};
        window.NIG_BADMINTON_PUBLIC_JSONP_URL = "https://example.test/public";
        const setTimeout = window.setTimeout.bind(window);
        window.setTimeout = (callback, delay) => setTimeout(callback, delay === 5000 ? 0 : delay);
        window.fetch = async () => {
          fetches++;
          if (!failure) throw new Error("Static data unavailable");
          return { ok: true, json: async () => structuredClone(baseData) };
        };
        const appendChild = window.document.head.appendChild.bind(window.document.head);
        window.document.head.appendChild = element => {
          const result = appendChild(element);
          if (element.tagName === "SCRIPT") {
            jsonpRequests++;
            const callback = new URL(element.src).searchParams.get("callback");
            if (failure !== "timeout") {
              window.queueMicrotask(() => failure ? element.onerror() : window[callback](structuredClone(baseData)));
            }
          }
          return result;
        };
      });
      assert.equal(jsonpRequests, 1);
      assert.equal(fetches, failure ? 1 : 0);
      assert.doesNotMatch(dom.window.document.getElementById(target).textContent, errorText);
      assert.equal(dom.window.document.querySelector('script[src^="https://example.test/public"]'), null);
    }
  });
}

test("schedule cards preserve response states, reservation times, privacy and the four-card boundary", async () => {
  const formUrl = "https://docs.google.com/forms/d/e/example/viewform";
  const data = { ...baseData, generatedAt: new Date().toISOString(), sessions:
    ["07-17", "07-24", "07-31", "08-07", "08-21", "08-28"].map((monthDay, index) => ({
      sessionId: `2099-${monthDay}`, date: `2099-${monthDay}`, time: "19:00-21:00",
      reservationTime: "18:00-21:30", reservationStatus: "provisional", reservationReference: "PRIVATE-TEST-REFERENCE",
      location: "Gym / 体育館", status: "scheduled",
      responseStatus: ["upcoming", "closed", "changes-open", "unavailable"][index] || "upcoming",
      attendingCount: index === 1 || index === 2 ? 12 : null,
      absentCount: index === 1 || index === 2 ? 3 : null,
      unansweredCount: index === 1 || index === 2 ? 2 : null,
      guestCount: index === 1 || index === 2 ? 1 : null,
      keyPickupStatus: ["awaiting-assignment", "confirmed", "pending", "awaiting-assignment"][index],
      roles: "Setup: private.person", formUrl: index === 2 ? formUrl : "",
    })) };
  const dom = await renderPage("index.html", "assets/app.js", data);
  const document = dom.window.document;
  const cards = document.querySelectorAll(".session-card");
  assert.equal(cards.length, 4);
  assert.equal(cards[0].querySelector(".session-date").textContent, "2099/7/17(金)");
  assert.match(cards[0].textContent, /Practice \/ 練習: 19:00-21:00/);
  assert.match(cards[0].textContent, /Reserved time \/ 施設予約時間: 18:00-21:30/);
  assert.match(cards[0].textContent, /Provisional \/ 仮予約/);
  assert.match(cards[0].textContent, /attendance form opens during the week of the practice/i);
  assert.doesNotMatch(cards[0].textContent, /no response \/ 未回答/);
  assert.equal(cards[0].querySelector(".counts"), null);
  assert.match(cards[0].querySelector(".key-pickup-status").textContent, /準備担当の確定前/);
  assert.equal(document.getElementById("next-session-title").textContent, "2099/7/17(金) 19:00-21:00");
  assert.equal(document.getElementById("next-session-reservation").hidden, false);
  assert.match(document.getElementById("next-session-reservation").textContent, /18:00-21:30/);
  assert.match(cards[1].textContent, /12/);
  assert.match(cards[1].textContent, /attendance change window in the form has closed/i);
  assert.match(cards[1].querySelector(".key-pickup-confirmed").textContent, /受け取り済み/);
  assert.equal(cards[1].querySelector(".session-form-link"), null);
  assert.equal(cards[2].querySelector(".session-form-link").href, formUrl);
  assert.match(cards[2].textContent, /update attendance/i);
  assert.match(cards[2].querySelector(".key-pickup-status").textContent, /Not yet confirmed/);
  assert.match(cards[2].textContent, /30 minutes before practice/i);
  assert.match(cards[2].textContent, /not included in automatic role selection/i);
  assert.match(cards[2].textContent, /回答者本人へ、次回以降はできるだけ締切前に回答していただくよう、ご案内メールを送ります/);
  assert.doesNotMatch(cards[2].textContent, /注意メール/);
  assert.match(cards[3].textContent, /Attendance status is unavailable/);
  assert.equal(cards[3].querySelector(".counts"), null);
  assert.doesNotMatch(document.body.textContent, /PRIVATE-TEST-REFERENCE|private\.person/);
  const later = document.querySelectorAll(".session-date-item");
  assert.equal(later.length, 2);
  assert.equal(later[0].textContent, "2099/8/21(金)");
  assert.equal(later[1].textContent, "2099/8/28(金)");
  assert.doesNotMatch(document.querySelector(".session-date-list").textContent, /19:00|18:00|仮予約|体育館/);
});

test("cancelled and tentative states remain visible on both sides of the compact-list boundary", async () => {
  for (const status of ["cancelled", "tentative"]) {
    const data = structuredClone(baseData);
    data.generatedAt = new Date().toISOString();
    data.sessions = ["07-03", "07-10", "07-17", "07-24", "07-31"].map((date, i) => ({
      sessionId: `2099-${date}`, date: `2099-${date}`, time: "19:00-21:00",
      status: i >= 3 ? status : "scheduled", responseStatus: status === "cancelled" && i >= 3 ? "cancelled" : "upcoming",
    }));
    const dom = await renderPage("index.html", "assets/app.js", data);
    const label = status === "cancelled" ? /Cancelled \/ 中止/ : /Tentative \/ 仮予定/;
    assert.match(dom.window.document.querySelectorAll(".session-card")[3].textContent, label);
    const compact = dom.window.document.querySelector(".session-date-item");
    assert.match(compact.textContent, label);
    assert.equal(compact.getAttribute("aria-hidden"), null);
    assert.doesNotMatch(compact.textContent, /19:00|21:00/);
  }
});

test("cancelled practices use neutral guidance that is safe for every cancellation reason", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.sessions = [{
    sessionId: "2099-07-10",
    date: "2099-07-10",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "cancelled",
    responseStatus: "cancelled",
    roleStatus: "pending",
    keyPickupStatus: "not-required",
    publicNote: "",
    formUrl: "",
  }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  const card = dom.window.document.querySelector(".session-card");
  assert.match(card.textContent, /check the Google Group for the reason and any next steps/i);
  assert.match(card.textContent, /理由と今後の対応はGoogle Groupで確認してください/);
  assert.doesNotMatch(card.textContent, /still want to practice|自主練習/);
  assert.match(card.querySelector(".key-pickup-not-required").textContent, /不要/);
  assert.equal(card.querySelector("a.session-form-link"), null);
});

test("invalid dates are excluded and public notices and policy render as text, not markup", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  data.policy.fees = "Fee / 参加費: <img src=x onerror=alert(1)>";
  data.sessions = [{
    sessionId: "2099-07-10",
    date: "2099-07-10",
    time: "19:00-21:00",
    location: "Gym / 体育館",
    status: "scheduled",
    responseStatus: "open",
    attendingCount: 0,
    absentCount: 0,
    unansweredCount: 0,
    guestCount: 0,
    publicNote: "<img src=x onerror=alert(1)>",
    formUrl: "javascript:alert(1)",
  }, { date: "zz<img src=x onerror=alert(1)>" }, { date: "2099-02-30" }];
  const dom = await renderPage("index.html", "assets/app.js", data);
  assert.equal(dom.window.document.querySelectorAll(".session-card").length, 1);
  const note = dom.window.document.querySelector(".session-note");
  assert.equal(note.querySelector("img"), null);
  assert.match(note.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(dom.window.document.querySelector(".session-form-link"), null);
  const policy = dom.window.document.getElementById("policy-content");
  assert.equal(policy.querySelector("img"), null);
  assert.match(policy.textContent, /Fee \/ 参加費: <img src=x onerror=alert\(1\)>/);
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

test("cancellation marks show reasons on hover and tap without entering attendance totals or TSV", async () => {
  const reason = "Gym unavailable / 体育館が利用できないため\n<img src=x onerror=alert(1)>";
  const data = { ...baseData, sessions: [
    { date: "2024-02-29", status: "cancelled", attendingCount: null, guestCount: null, publicNote: reason },
    { date: "2025-01-03", status: "cancelled", attendingCount: 99, guestCount: 99, publicNote: " " },
    { date: "2025-01-10", status: "scheduled", attendingCount: 0, guestCount: 0 },
    { date: "2025-02-29", status: "cancelled", publicNote: "Invalid date" },
    { date: "2099-01-03", status: "cancelled", publicNote: "Future" },
  ] };
  for (const width of [900, 264]) {
    const marks = [];
    let path = [];
    const dom = await renderPage("attendance.html", "assets/attendance.js", data, window => {
      window.CanvasRenderingContext2D = function () {};
      const canvas = window.document.getElementById("attendance-chart");
      Object.defineProperty(canvas.parentElement, "clientWidth", { value: width });
      canvas.getContext = () => new Proxy({
        beginPath: () => { path = []; },
        moveTo: (x, y) => path.push([x, y]),
        lineTo: (x, y) => path.push([x, y]),
        stroke: () => {
          if (path.length === 4) marks.push({ x: path[0][0] + 4, y: path[0][1] + 4 });
        },
      }, { get: (target, key) => target[key] || (() => {}) });
    });
    const document = dom.window.document;
    assert.equal(document.getElementById("recorded-session-count").textContent, "1");
    assert.equal(document.getElementById("recorded-year-range").textContent, "2024–2025");
    const rows = document.querySelectorAll("#cancelled-records-body tr");
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /Reason not recorded/);
    assert.equal(rows[1].querySelector("td").textContent, reason);
    assert.equal(document.querySelector("#cancelled-records-body img"), null);
    const tsv = decodeURIComponent(document.getElementById("attendance-download").href.split(",")[1]);
    assert.equal(tsv, "\uFEFFdate\tattending_count\tguest_count\ttotal_participants\r\n2025-01-10\t0\t0\t0\r\n");
    assert.equal(marks.length, 2);
    const canvas = document.getElementById("attendance-chart");
    const tooltip = document.getElementById("attendance-tooltip");
    assert.equal(canvas.style.width, `${width}px`);
    for (const event of ["pointermove", "pointerdown"]) {
      canvas.dispatchEvent(new dom.window.MouseEvent(event, { clientX: marks[0].x, clientY: marks[0].y }));
      assert.equal(tooltip.hidden, false);
      assert.match(tooltip.textContent, /2024\/2\/29/);
      assert.match(tooltip.textContent, /体育館が利用できないため/);
      assert.equal(tooltip.querySelector("img"), null);
      assert.doesNotMatch(tooltip.textContent, /Total \/ 合計/);
    }
    canvas.dispatchEvent(new dom.window.MouseEvent("pointerdown", { clientX: marks[1].x, clientY: marks[1].y }));
    assert.match(tooltip.textContent, /理由未記録/);
    const touchLeave = new dom.window.Event("pointerleave");
    Object.defineProperty(touchLeave, "pointerType", { value: "touch" });
    canvas.dispatchEvent(touchLeave);
    assert.equal(tooltip.hidden, false, "A tap keeps its details visible after the finger leaves");
    document.body.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true }));
    assert.equal(tooltip.hidden, true);
    canvas.dispatchEvent(new dom.window.MouseEvent("pointermove", { clientX: marks[0].x, clientY: marks[0].y }));
    canvas.dispatchEvent(new dom.window.MouseEvent("pointerleave"));
    assert.equal(tooltip.hidden, true);
  }
});

test("cancellation-only history remains visible and excludes today in Japan", async () => {
  const data = { ...baseData, sessions: [
    { date: "2026-10-12", responseStatus: "cancelled", publicNote: "休館" },
    { date: "2026-10-13", status: "cancelled", publicNote: "Today" },
    { date: "2026-10-14", status: "cancelled", publicNote: "Future" },
    { date: "2026-10-11", status: "scheduled", attendingCount: null },
  ] };
  const dom = await renderPage("attendance.html", "assets/attendance.js", data, window => {
    const OriginalDate = window.Date;
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : ["2026-10-12T15:00:00Z"])); }
    };
  });
  const document = dom.window.document;
  assert.equal(document.querySelectorAll("#cancelled-records-body tr").length, 1);
  assert.match(document.getElementById("cancelled-records-body").textContent, /2026\/10\/12.*休館/s);
  assert.equal(document.getElementById("attendance-figure").hidden, false);
  assert.equal(document.getElementById("attendance-empty").hidden, false);
  assert.equal(document.getElementById("attendance-download").getAttribute("aria-disabled"), "true");
  assert.equal(document.getElementById("recorded-session-count").textContent, "0");
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

test("admin and membership links reject unsafe URLs and remain unavailable without a valid destination", async () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", ""]) {
    const admin = await renderPage("admin.html", "assets/admin.js", baseData, window => {
      window.NIG_BADMINTON_ADMIN_URL = url;
    });
    assert.equal(admin.window.document.getElementById("admin-console-link").hasAttribute("href"), false);
    const join = await renderPage("join.html", "assets/join.js", { ...baseData, membership: { formUrl: url } });
    assert.equal(join.window.document.getElementById("membership-form-link").hasAttribute("href"), false);
    assert.match(join.window.document.getElementById("membership-status").textContent, /being prepared/);
  }
});

test("public HTML does not expose administrator account IDs", () => {
  const html = fs.readdirSync(docsUrl)
    .filter((name) => name.endsWith(".html"))
    .map((name) => read(name))
    .join("\n");
  assert.doesNotMatch(html, /kenji\.fukushima|nyamatan/);
});

test("rendered public pages have no detectable structural accessibility violations", async () => {
  const data = structuredClone(baseData);
  data.generatedAt = new Date().toISOString();
  const pages = [
    ["index.html", "assets/app.js"],
    ["attendance.html", "assets/attendance.js"],
    ["about.html", "assets/app.js"],
    ["join.html", "assets/join.js"],
    ["admin.html", "assets/admin.js"],
    ["workflow.html", null],
    ["role-assignment.html", null],
    ["privacy.html", null],
  ];
  for (const [htmlPath, scriptPath] of pages) {
    const dom = await renderPage(htmlPath, scriptPath, data);
    try {
      dom.window.eval(axe.source);
      const results = await dom.window.axe.run(dom.window.document, {
        resultTypes: ["violations"],
        rules: { "color-contrast": { enabled: false } },
      });
      assert.equal(results.violations.length, 0,
        `${htmlPath}: ${results.violations.map(v => `${v.id} (${v.nodes.length})`).join(", ")}`);
    } finally { close(dom); }
  }
});
