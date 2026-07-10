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
    if (Number.isNaN(date.getTime())) return String(dateString || "");
    const english = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
    const japanese = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      weekday: "short",
      month: "numeric",
      day: "numeric",
    }).format(date);
    return `${english} / ${japanese}`;
  }

  function formatDateTimeParts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      const fallback = String(value || "");
      return { en: fallback, ja: fallback };
    }
    const options = {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const english = new Intl.DateTimeFormat("en-US", options).format(date);
    const japanese = new Intl.DateTimeFormat("ja-JP", options).format(date);
    return { en: `${english} JST`, ja: japanese };
  }

  function formatDateTime(value) {
    const parts = formatDateTimeParts(value);
    return `${parts.en} / ${parts.ja}`;
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
      title.textContent = "No upcoming practice scheduled / 今後の練習予定はありません";
      location.textContent = "";
      form.removeAttribute("href");
      form.setAttribute("aria-disabled", "true");
      form.tabIndex = -1;
      form.textContent = "Attendance Form / 出欠フォーム";
      return;
    }
    title.textContent = `${formatDate(session.date)} ${session.time}`;
    location.textContent = session.location;
    const formUrl = safeHref(session.formUrl);
    if (formUrl) {
      form.href = formUrl;
      form.removeAttribute("aria-disabled");
      form.removeAttribute("tabindex");
      form.textContent = "Attendance Form / 出欠フォーム";
    } else {
      form.removeAttribute("href");
      form.setAttribute("aria-disabled", "true");
      form.tabIndex = -1;
      form.textContent = session.responseStatus === "upcoming"
        ? "Opens during the practice week / 練習週に受付開始"
        : "Attendance form closed / 出欠回答締切済み";
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
      countBlock(stats && stats.totalCount, "Total / 合計"),
      countBlock(stats && stats.nigCount, "NIG members / 遺伝研内"),
      countBlock(stats && stats.externalCount, "External members / 遺伝研外"),
    ].join("");

    if (!stats || !stats.lastSuccessAt) {
      detail.textContent = "Member counts will appear after Google Groups access is authorized. / Google Groupsへのアクセス承認後に部員数を表示します。";
      return;
    }
    detail.textContent = stats.status === "ok"
      ? `Last updated / 最終更新: ${formatDateTime(stats.lastSuccessAt)}`
      : `Last successful update / 最後に更新できた日時: ${formatDateTime(stats.lastSuccessAt)}`;
  }

  function responseStateText(session) {
    if (session.responseStatus === "upcoming") {
      return "The attendance form opens during the week of the practice. / 出欠フォームは練習のある週に受付を開始します。";
    }
    if (session.responseStatus === "closed") {
      return "The attendance form is closed. Please email any later changes to the Google Group. / 出欠フォームは締め切りました。以降の変更はGoogle Groupへメールしてください。";
    }
    if (session.responseStatus === "cancelled") return "This practice has been cancelled. / この練習は中止になりました。";
    return "The attendance form is open. / 出欠回答を受け付けています。";
  }

  function renderSessions(sessions, nextSession) {
    const container = document.getElementById("session-list");
    if (!container) return;
    if (!sessions.length) {
      container.innerHTML = `<p class="muted">There are no upcoming practices on the schedule. / 現在、今後の練習予定はありません。</p>`;
      return;
    }
    container.innerHTML = sessions.map((session) => {
      const isNext = nextSession && session.sessionId === nextSession.sessionId;
      const statusClass = session.status === "cancelled" ? "status cancelled" : "status";
      const formUrl = safeHref(session.formUrl);
      const formLink = formUrl
        ? `<a class="session-form-link" href="${escapeHtml(formUrl)}" rel="noopener">Attendance form / 出欠フォーム</a>`
        : session.responseStatus === "closed"
          ? `<span class="muted">${escapeHtml(responseStateText(session))}</span>`
          : "";
      const countMarkup = session.responseStatus === "upcoming" || session.responseStatus === "cancelled"
        ? `<p class="response-state">${escapeHtml(responseStateText(session))}</p>`
        : `<div class="counts">
            ${countBlock(session.attendingCount, "Attending / 参加")}
            ${countBlock(session.absentCount, "Not attending / 不参加")}
            ${countBlock(session.unansweredCount, "No response / 未回答")}
            ${countBlock(session.guestCount, "Guests / ゲスト")}
          </div>`;
      const publicNote = session.publicNote
        ? `<p class="session-note"><strong>Note / 連絡事項:</strong> ${escapeHtml(session.publicNote)}</p>`
        : "";
      return `
        <article class="session-card ${isNext ? "is-next" : ""}">
          <div class="session-topline">
            <div>
              <div class="session-date">${formatDate(session.date)}</div>
              <div class="muted">${escapeHtml(session.time)}</div>
            </div>
            <span class="${statusClass}">${escapeHtml(formatStatus(session.status))}</span>
          </div>
          ${countMarkup}
          ${publicNote}
          ${formLink ? `<div>${formLink}</div>` : ""}
        </article>
      `;
    }).join("");
  }

  function renderPolicy(policy = {}) {
    const container = document.getElementById("policy-content");
    if (!container) return;
    const eligible = (policy.eligible || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const requirements = (policy.requirements || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    container.innerHTML = `
      <div>
        <h3>Who can join / 参加対象</h3>
        <ul>${eligible}</ul>
      </div>
      <div>
        <h3>What to bring and how to contact us / 持ち物・連絡方法</h3>
        <ul>${requirements}</ul>
      </div>
      <div>
        <h3>Participation fees / 参加費</h3>
        <p>${escapeHtml(policy.fees || "")}</p>
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
        ? `Website data updated / サイトデータ更新: ${formatDateTime(data.generatedAt)}`
        : "";
    }
    const groupLink = document.getElementById("group-link");
    const membership = data.membership || {};
    const membershipUrl = safeHref(membership.requestUrl || "join.html");
    if (groupLink) {
      if (membershipUrl) groupLink.href = membershipUrl;
      groupLink.textContent = "Join or Leave / 入退会";
      groupLink.title = "Join or leave the club, or update your registered address / 入会・退会・登録アドレス変更";
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

  function renderDataHealth(data) {
    const banner = document.getElementById("data-health");
    if (!banner) return;
    const generatedAt = new Date(data.generatedAt || "");
    const ageHours = (Date.now() - generatedAt.getTime()) / (60 * 60 * 1000);
    // The backend refreshes unchanged public data every eight hours. Allow one
    // trigger interval plus deployment propagation before warning visitors.
    if (Number.isFinite(ageHours) && ageHours >= 0 && ageHours <= 8.25) {
      banner.hidden = true;
      banner.textContent = "";
      return;
    }
    banner.hidden = false;
    const english = document.createElement("span");
    const japanese = document.createElement("span");
    english.lang = "en";
    japanese.lang = "ja";
    if (data.generatedAt) {
      const updated = formatDateTimeParts(data.generatedAt);
      english.textContent = `The website may not have the latest data (last updated: ${updated.en}). Members can check the Google Calendar for the current schedule.`;
      japanese.textContent = `サイトの情報が最新でない可能性があります（最終更新: ${updated.ja}）。最新の予定は部員用Googleカレンダーで確認できます。`;
    } else {
      english.textContent = "The website's last update time is unavailable.";
      japanese.textContent = "サイトの最終更新時刻を確認できません。";
    }
    banner.replaceChildren(english, japanese);
  }

  loadData()
    .then((data) => {
      const sessions = upcomingSessions(data.sessions || []);
      const nextSession = findNextSession(sessions);
      renderMeta(data);
      renderDataHealth(data);
      renderNextSession(nextSession);
      renderMemberStats(data.memberStats || {});
      renderSessions(sessions, nextSession);
      renderPolicy(data.policy || {});
    })
    .catch((error) => {
      console.error(error);
      const title = document.getElementById("next-session-title");
      if (title) title.textContent = "Practice schedule unavailable / 練習予定を読み込めません";
      const detail = document.getElementById("member-stats-detail");
      if (detail) detail.textContent = "Member counts are unavailable. / 部員数を読み込めません。";
      const banner = document.getElementById("data-health");
      if (banner) {
        banner.hidden = false;
        banner.textContent = "The website data could not be loaded. Please try again later. / サイトのデータを読み込めませんでした。時間をおいて再度お試しください。";
      }
    });
})();
