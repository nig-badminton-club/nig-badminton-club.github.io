(function () {
  function normalizeLabel(link) {
    return String(link.getAttribute("aria-label") || link.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function sendEvent(eventName, link) {
    if (!eventName || typeof window.gtag !== "function") return;
    window.gtag("event", eventName, {
      page_path: window.location.pathname,
      link_url: link.href,
      link_label: normalizeLabel(link),
    });
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    const link = target && target.closest ? target.closest("a[data-analytics-event][href]") : null;
    if (!link) return;
    sendEvent(String(link.dataset.analyticsEvent || "").trim(), link);
  });
})();
