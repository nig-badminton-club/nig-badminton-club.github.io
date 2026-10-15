(function () {
  let requestId = 0;

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `nigBadmintonCallback_${Date.now()}_${++requestId}`;
      const script = document.createElement("script");
      const separator = url.includes("?") ? "&" : "?";
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("JSONP load timed out"));
      }, 5000);
      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }
      window[callbackName] = payload => { cleanup(); resolve(payload); };
      script.onerror = () => { cleanup(); reject(new Error("JSONP load failed")); };
      script.async = true;
      script.src = `${url}${separator}callback=${callbackName}`;
      document.head.appendChild(script);
    });
  }

  async function loadData() {
    const jsonpUrl = window.NIG_BADMINTON_PUBLIC_JSONP_URL || "";
    if (jsonpUrl) {
      try { return await loadJsonp(jsonpUrl); }
      catch (error) { console.warn(error); }
    }
    const response = await fetch("data/public.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Public data request failed: HTTP ${response.status}`);
    return response.json();
  }

  function validateData(data) {
    if (!data || !Array.isArray(data.sessions) || data.sessions.some(session => !session || typeof session !== "object")) {
      throw new Error("Public data has an invalid sessions list.");
    }
    return data;
  }

  function safeHref(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) { return ""; }
  }

  window.NigBadmintonPublic = { loadData, validateData, safeHref };
})();
