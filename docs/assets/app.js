(function () {
  const fallbackUrl = "data/public.json";
  const jsonpUrl = window.NIG_BADMINTON_PUBLIC_JSONP_URL || "";

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `nigBadmintonCallback_${Date.now()}`;
      const script = document.createElement("script");
      const separator = url.indexOf("?") === -1 ? "?" : "&";
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("JSONP load timed out"));
      }, 5000);
      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }
      window[callbackName] = (payload) => {
        cleanup();
        resolve(payload);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error("JSONP load failed"));
      };
      script.async = true;
      script.src = `${url}${separator}callback=${callbackName}`;
      document.head.appendChild(script);
    });
  }

  async function loadData() {
    if (jsonpUrl) {
      try {
        return await loadJsonp(jsonpUrl);
      } catch (error) {
        console.warn(error);
      }
    }
    const response = await fetch(fallbackUrl, { cache: "no-store" });
    return response.json();
  }

  function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00+09:00`);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function findNextSession(sessions) {
    const todayKey = getTodayKey();
    return sessions.find((session) => session.date >= todayKey && session.status !== "cancelled") || null;
  }

  function getTodayKey() {
    const today = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(today);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function upcomingSessions(sessions) {
    const todayKey = getTodayKey();
    return sessions
      .filter((session) => String(session.date || "") >= todayKey)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[character]));
  }

  function safeHref(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function formatCount(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : "—";
  }

  function formatStatus(value) {
    const status = String(value || "");
    if (status === "scheduled") return "scheduled / 予定";
    if (status === "cancelled") return "cancelled / 中止";
    if (status === "tentative") return "tentative / 仮予定";
    return status;
  }

  function renderNextSession(session) {
    const title = document.getElementById("next-session-title");
    const location = document.getElementById("next-session-location");
    const form = document.getElementById("next-session-form");
    if (!title || !location || !form) return;
    if (!session) {
      title.textContent = "No scheduled practice / 練習予定はありません";
      location.textContent = "";
      form.setAttribute("aria-disabled", "true");
      return;
    }
    title.textContent = `${formatDate(session.date)} ${session.time}`;
    location.textContent = session.location;
    const formUrl = safeHref(session.formUrl);
    if (formUrl) {
      form.href = formUrl;
      form.removeAttribute("aria-disabled");
    } else {
      form.href = "#";
      form.setAttribute("aria-disabled", "true");
    }
  }

  function countBlock(number, label) {
    return `<div class="count"><strong>${escapeHtml(formatCount(number))}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function renderMemberStats(stats) {
    const counts = document.getElementById("member-stats-counts");
    const detail = document.getElementById("member-stats-detail");
    if (!counts || !detail) return;

    counts.innerHTML = [
      countBlock(stats && stats.totalCount, "total / 合計"),
      countBlock(stats && stats.nigCount, "NIG / 遺伝研"),
      countBlock(stats && stats.externalCount, "external / 遺伝研外"),
    ].join("");

    if (!stats || !stats.lastSuccessAt) {
      detail.textContent = "Member count pending Google Group authorization / Google Groups承認後に更新";
      return;
    }
    detail.textContent = stats.status === "ok"
      ? `Updated ${stats.lastSuccessAt} / 更新 ${stats.lastSuccessAt}`
      : `Last successful update ${stats.lastSuccessAt} / 最終成功更新 ${stats.lastSuccessAt}`;
  }

  function renderSessions(sessions, nextSession) {
    const container = document.getElementById("session-list");
    if (!container) return;
    if (!sessions.length) {
      container.innerHTML = `<p class="muted">No upcoming practice is scheduled. / 今後の練習予定はありません。</p>`;
      return;
    }
    container.innerHTML = sessions.map((session) => {
      const isNext = nextSession && session.sessionId === nextSession.sessionId;
      const statusClass = session.status === "cancelled" ? "status cancelled" : "status";
      const formUrl = safeHref(session.formUrl);
      const formLink = formUrl
        ? `<a class="session-form-link" href="${escapeHtml(formUrl)}" rel="noopener">Attendance form / 出欠フォーム</a>`
        : `<span class="muted">Form link pending / フォームリンク準備中</span>`;
      return `
        <article class="session-card ${isNext ? "is-next" : ""}">
          <div class="session-topline">
            <div>
              <div class="session-date">${formatDate(session.date)}</div>
              <div class="muted">${escapeHtml(session.time)}</div>
            </div>
            <span class="${statusClass}">${escapeHtml(formatStatus(session.status))}</span>
          </div>
          <div class="counts">
            ${countBlock(session.attendingCount, "attending / 参加")}
            ${countBlock(session.absentCount, "not attending / 不参加")}
            ${countBlock(session.unansweredCount, "no response / 未回答")}
            ${countBlock(session.guestCount, "guests / ゲスト")}
          </div>
          <div class="roles">${escapeHtml(session.roles || "Roles pending / 担当未確定")}</div>
          <div>${formLink}</div>
        </article>
      `;
    }).join("");
  }

  function renderPolicy(policy) {
    const container = document.getElementById("policy-content");
    if (!container) return;
    const eligible = (policy.eligible || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const requirements = (policy.requirements || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    container.innerHTML = `
      <div>
        <h3>Eligible participants / 参加対象</h3>
        <ul>${eligible}</ul>
      </div>
      <div>
        <h3>Requirements / 必要なもの・連絡</h3>
        <ul>${requirements}</ul>
      </div>
      <div>
        <h3>Rackets / ラケット</h3>
        <p>${escapeHtml(policy.rackets || "")}</p>
      </div>
      <div>
        <h3>Guests / ゲスト</h3>
        <p>${escapeHtml(policy.guests || "")}</p>
      </div>
    `;
  }

  function renderMeta(data) {
    const generatedAt = document.getElementById("generated-at");
    if (generatedAt) {
      generatedAt.textContent = data.generatedAt
        ? `Updated ${data.generatedAt} ${data.timezone || ""} / 更新 ${data.generatedAt} ${data.timezone || ""}`
        : "";
    }
    const groupLink = document.getElementById("group-link");
    const membership = data.membership || {};
    const membershipUrl = safeHref(membership.requestUrl || "join.html");
    if (groupLink) {
      if (membershipUrl) groupLink.href = membershipUrl;
      groupLink.textContent = "Join / 入会申請";
      groupLink.title = "Request access to the club Google Group / Google Groupへの参加依頼";
    }

    const calendar = data.calendar || {};
    const calendarLink = document.getElementById("calendar-link");
    const calendarUrl = safeHref(calendar.url);
    if (calendarLink) {
      if (calendarUrl) calendarLink.href = calendarUrl;
      calendarLink.textContent = calendar.access
        ? "Google Calendar (group only) / Googleカレンダー（部員限定）"
        : "Google Calendar / Googleカレンダー";
      if (calendar.access) calendarLink.title = calendar.access;
    }

    const venue = data.venue || {};
    const mapLink = document.getElementById("map-link");
    const mapEmbed = document.getElementById("map-embed");
    const mapLocationName = document.getElementById("map-location-name");
    if (mapLocationName) {
      mapLocationName.textContent = venue.name || "Mishima Municipal Nishikida Elementary School Gym / 三島市立錦田小学校 体育館";
    }
    const mapUrl = safeHref(venue.mapUrl);
    const mapEmbedUrl = safeHref(venue.mapEmbedUrl);
    if (mapLink && mapUrl) mapLink.href = mapUrl;
    if (mapEmbed && mapEmbedUrl) mapEmbed.src = mapEmbedUrl;
  }

  loadData()
    .then((data) => {
      const sessions = upcomingSessions(data.sessions || []);
      const nextSession = findNextSession(sessions);
      renderMeta(data);
      renderNextSession(nextSession);
      renderMemberStats(data.memberStats || {});
      renderSessions(sessions, nextSession);
      renderPolicy(data.policy || {});
    })
    .catch((error) => {
      console.error(error);
      const title = document.getElementById("next-session-title");
      if (title) title.textContent = "Schedule unavailable / 練習予定を読み込めません";
      const detail = document.getElementById("member-stats-detail");
      if (detail) detail.textContent = "Member count unavailable / 部員数を読み込めません";
    });
})();
