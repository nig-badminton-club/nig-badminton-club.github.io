(function () {
  const fallbackUrl = "data/public.json";
  const jsonpUrl = window.NIG_BADMINTON_PUBLIC_JSONP_URL || "";
  const status = document.getElementById("membership-status");
  const link = document.getElementById("membership-form-link");

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
        status.textContent = "The membership form is being prepared. Please check back soon. / メンバー手続きフォームを準備中です。しばらくしてから再度ご確認ください。";
        link.removeAttribute("href");
        link.tabIndex = -1;
        return;
      }
      link.href = formUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
      status.textContent = "Use the Google Form to join or leave the club, update your registered address, or contact the managers. Google sign-in is required so the request can be verified. / Googleフォームから、入会・退会・登録アドレス変更・管理者への連絡を行えます。申請内容の確認のため、Googleへのログインが必要です。";
    })
    .catch((error) => {
      console.error(error);
      status.textContent = "The membership form is currently unavailable. Please try again later. / 現在、メンバー手続きフォームを利用できません。時間をおいて再度お試しください。";
    });
})();
