(function () {
  const fallbackUrl = "data/public.json";
  const jsonpUrl = window.NIG_BADMINTON_PUBLIC_JSONP_URL || "";
  const publicDataFreshHours = 7 * 24;
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let chartState = null;

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `nigBadmintonAttendanceCallback_${Date.now()}`;
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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[character]));
  }

  function formatDate(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ""));
    if (!match) return String(dateString || "");
    return `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    const english = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    const japanese = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return `${english} JST / ${japanese}`;
  }

  function sessionPoint(session) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(session.date || ""));
    if (!match || !Number.isFinite(session.attendingCount)) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12) return null;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) return null;
    const attending = Math.max(0, Number(session.attendingCount));
    const guests = Number.isFinite(session.guestCount) ? Math.max(0, Number(session.guestCount)) : 0;
    return {
      date: session.date,
      year,
      month,
      day,
      xValue: month - 1 + (day - 1) / daysInMonth,
      attending,
      guests,
      total: attending + guests,
    };
  }

  function collectSeries(sessions) {
    const todayKey = getTodayKey();
    const points = sessions
      .filter((session) => String(session.status || "") !== "cancelled" && String(session.date || "") < todayKey)
      .map(sessionPoint)
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));
    const grouped = new Map();
    points.forEach((point) => {
      if (!grouped.has(point.year)) grouped.set(point.year, []);
      grouped.get(point.year).push(point);
    });
    const years = Array.from(grouped.keys()).sort((a, b) => a - b);
    return {
      points,
      series: years.map((year, index) => ({
        year,
        points: grouped.get(year),
        color: colorForYear(index, years.length),
        lineWidth: index === years.length - 1 ? 3 : 2,
      })),
    };
  }

  function getTodayKey() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function colorForYear(index, count) {
    const progress = count <= 1 ? 1 : index / (count - 1);
    const lightness = Math.round(70 - progress * 38);
    return `hsl(207 58% ${lightness}%)`;
  }

  function renderSummary(points, series) {
    const count = document.getElementById("recorded-session-count");
    const range = document.getElementById("recorded-year-range");
    if (count) count.textContent = String(points.length);
    if (range) {
      const years = series.map((item) => item.year);
      range.textContent = years.length === 0
        ? "—"
        : years.length === 1
          ? String(years[0])
          : `${years[0]}–${years[years.length - 1]}`;
    }
  }

  function renderLegend(series) {
    const legend = document.getElementById("attendance-legend");
    if (!legend) return;
    legend.innerHTML = series.map((item) => `
      <li class="attendance-legend-item">
        <span class="attendance-legend-line" style="background:${escapeHtml(item.color)}"></span>
        ${escapeHtml(item.year)}
      </li>
    `).join("");
  }

  function renderTable(points) {
    const body = document.getElementById("attendance-records-body");
    if (!body) return;
    body.innerHTML = points.length
      ? points.slice(-20).reverse().map((point) => `
          <tr>
            <th scope="row">${escapeHtml(formatDate(point.date))}</th>
            <td>${escapeHtml(point.attending)}</td>
            <td>${escapeHtml(point.guests)}</td>
            <td><strong>${escapeHtml(point.total)}</strong></td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">No completed totals / 集計済みデータなし</td></tr>`;
  }

  function renderDownload(points) {
    const link = document.getElementById("attendance-download");
    if (!link) return;
    if (!points.length) {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
      return;
    }
    const rows = [
      ["date", "attending_count", "guest_count", "total_participants"],
      ...points.map((point) => [point.date, point.attending, point.guests, point.total]),
    ];
    const tsv = `\uFEFF${rows.map((row) => row.join("\t")).join("\r\n")}\r\n`;
    link.href = `data:text/tab-separated-values;charset=utf-8,${encodeURIComponent(tsv)}`;
    link.download = "nig-badminton-attendance.tsv";
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  }

  function chartLayout(width, height, maxTotal) {
    const narrow = width < 620;
    const margin = {
      top: 22,
      right: narrow ? 14 : 24,
      bottom: narrow ? 58 : 54,
      left: narrow ? 44 : 54,
    };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const yMax = Math.max(5, Math.ceil(maxTotal / 5) * 5);
    return {
      width,
      height,
      margin,
      plotWidth,
      plotHeight,
      yMax,
      x: (value) => margin.left + (value / 11.999) * plotWidth,
      y: (value) => margin.top + plotHeight - (value / yMax) * plotHeight,
    };
  }

  function drawChart(series) {
    const canvas = document.getElementById("attendance-chart");
    if (!canvas || !window.CanvasRenderingContext2D) return;
    const wrap = canvas.parentElement;
    const width = Math.max(320, Math.floor(wrap.clientWidth));
    const height = width < 620 ? 390 : 470;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);

    const maxTotal = Math.max(...series.flatMap((item) => item.points.map((point) => point.total)), 0);
    const layout = chartLayout(width, height, maxTotal);
    const { margin, plotWidth, plotHeight, yMax } = layout;
    context.clearRect(0, 0, width, height);
    context.font = "12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    context.textBaseline = "middle";

    for (let value = 0; value <= yMax; value += 5) {
      const y = layout.y(value);
      context.strokeStyle = value === 0 ? "#9ba7b7" : "#e1e6ee";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(margin.left + plotWidth, y);
      context.stroke();
      context.fillStyle = "#5d6878";
      context.textAlign = "right";
      context.fillText(String(value), margin.left - 10, y);
    }

    monthLabels.forEach((label, index) => {
      const x = layout.x(index);
      context.strokeStyle = "#edf0f5";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, margin.top + plotHeight);
      context.stroke();
      context.save();
      context.translate(x, margin.top + plotHeight + 16);
      context.rotate(width < 620 ? -Math.PI / 3 : 0);
      context.fillStyle = "#5d6878";
      context.textAlign = width < 620 ? "right" : "center";
      context.fillText(width < 620 ? String(index + 1) : label, 0, 0);
      context.restore();
    });

    const hitPoints = [];
    series.forEach((item) => {
      context.strokeStyle = item.color;
      context.lineWidth = item.lineWidth;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      item.points.forEach((point, index) => {
        const x = layout.x(point.xValue);
        const y = layout.y(point.total);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (item.points.length > 1) context.stroke();

      item.points.forEach((point) => {
        const x = layout.x(point.xValue);
        const y = layout.y(point.total);
        context.beginPath();
        context.arc(x, y, item.year === series[series.length - 1].year ? 5 : 4, 0, Math.PI * 2);
        context.fillStyle = item.color;
        context.fill();
        context.strokeStyle = "#fffdf8";
        context.lineWidth = 2;
        context.stroke();
        hitPoints.push({ x, y, point, color: item.color });
      });
    });

    context.save();
    context.translate(14, margin.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "#5d6878";
    context.textAlign = "center";
    context.fillText("People / 人", 0, 0);
    context.restore();
    chartState = { canvas, hitPoints, layout };
  }

  function hideTooltip() {
    const tooltip = document.getElementById("attendance-tooltip");
    if (tooltip) tooltip.hidden = true;
  }

  function showNearestPoint(event) {
    if (!chartState) return;
    const tooltip = document.getElementById("attendance-tooltip");
    if (!tooltip) return;
    const rect = chartState.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nearest = chartState.hitPoints.reduce((best, candidate) => {
      const distance = Math.hypot(candidate.x - x, candidate.y - y);
      return !best || distance < best.distance ? { ...candidate, distance } : best;
    }, null);
    if (!nearest || nearest.distance > 22) {
      hideTooltip();
      return;
    }
    tooltip.innerHTML = `<strong>${escapeHtml(formatDate(nearest.point.date))}</strong><span>Total / 合計: ${escapeHtml(nearest.point.total)}</span><span>Attending / 参加回答者: ${escapeHtml(nearest.point.attending)} · Guests / ゲスト: ${escapeHtml(nearest.point.guests)}</span>`;
    tooltip.style.left = `${Math.min(Math.max(nearest.x, 108), chartState.layout.width - 108)}px`;
    tooltip.style.top = `${Math.max(nearest.y - 12, 62)}px`;
    tooltip.hidden = false;
  }

  function renderMeta(data) {
    const generatedAt = document.getElementById("generated-at");
    if (generatedAt) {
      generatedAt.textContent = data.generatedAt
        ? `Website data updated / サイトデータ更新: ${formatDateTime(data.generatedAt)}`
        : "";
    }
  }

  function renderDataHealth(data) {
    const banner = document.getElementById("data-health");
    if (!banner) return;
    const generatedAt = new Date(data.generatedAt || "");
    const ageHours = (Date.now() - generatedAt.getTime()) / (60 * 60 * 1000);
    if (Number.isFinite(ageHours) && ageHours >= 0 && ageHours <= publicDataFreshHours + 0.25) {
      banner.hidden = true;
      banner.textContent = "";
      return;
    }
    banner.hidden = false;
    banner.textContent = data.generatedAt
      ? `The website may not have the latest data (last updated: ${formatDateTime(data.generatedAt)}). / サイトの情報が最新でない可能性があります（最終更新: ${formatDateTime(data.generatedAt)}）。`
      : "The website's last update time is unavailable. / サイトの最終更新時刻を確認できません。";
  }

  function render(data) {
    const { points, series } = collectSeries(data.sessions || []);
    renderMeta(data);
    renderDataHealth(data);
    renderSummary(points, series);
    renderLegend(series);
    renderTable(points);
    renderDownload(points);

    const empty = document.getElementById("attendance-empty");
    const figure = document.getElementById("attendance-figure");
    if (empty) empty.hidden = points.length > 0;
    if (figure) figure.hidden = points.length === 0;
    if (!points.length) return;

    drawChart(series);
    const canvas = document.getElementById("attendance-chart");
    if (canvas) {
      canvas.addEventListener("pointermove", showNearestPoint);
      canvas.addEventListener("pointerleave", hideTooltip);
    }
    let resizeFrame = 0;
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => drawChart(series));
    });
  }

  loadData()
    .then(render)
    .catch((error) => {
      console.error(error);
      const empty = document.getElementById("attendance-empty");
      const figure = document.getElementById("attendance-figure");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Attendance data could not be loaded. / 参加者数のデータを読み込めませんでした。";
      }
      if (figure) figure.hidden = true;
    });
})();
