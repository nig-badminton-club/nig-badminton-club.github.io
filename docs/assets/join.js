(function () {
  const fallbackUrl = "data/public.json";
  const jsonpUrl = window.NIG_BADMINTON_PUBLIC_JSONP_URL || "";
  const status = document.getElementById("membership-status");
  const link = document.getElementById("membership-form-link");
  const wrap = document.getElementById("membership-form-wrap");
  const iframe = document.getElementById("membership-form-embed");

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `nigBadmintonJoinCallback_${Date.now()}`;
      const script = document.createElement("script");
      const separator = url.indexOf("?") === -1 ? "?" : "&";
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("JSONP load timed out"));
      }, 3500);
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
    const response = await fetch(fallbackUrl, { cache: "no-store" });
    const fallback = await response.json();
    if (!jsonpUrl) return fallback;
    try {
      return await loadJsonp(jsonpUrl);
    } catch (error) {
      console.warn(error);
      return fallback;
    }
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

  loadData()
    .then((data) => {
      const formUrl = safeHref(data.membership && data.membership.formUrl);
      if (!formUrl) {
        status.textContent = "Request form is being prepared. / 申請フォームを準備中です。";
        link.removeAttribute("href");
        link.tabIndex = -1;
        return;
      }
      link.href = formUrl;
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
      status.textContent = "Use the form below to request membership. / 下のフォームから入会申請を送ってください。";
      const embedUrl = new URL(formUrl);
      embedUrl.searchParams.set("embedded", "true");
      iframe.src = embedUrl.href;
      wrap.hidden = false;
    })
    .catch((error) => {
      console.error(error);
      status.textContent = "Request form is unavailable. / 申請フォームを読み込めません。";
    });
})();
