(function () {
  const status = document.getElementById("admin-status");
  const link = document.getElementById("admin-console-link");
  const configuredUrl = window.NIG_BADMINTON_ADMIN_URL || "";
  const publicJsonpUrl = window.NIG_BADMINTON_PUBLIC_JSONP_URL || "";

  function withAdminPage(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.href);
      if (!["http:", "https:"].includes(parsed.protocol)) return "";
      parsed.searchParams.set("page", "admin");
      return parsed.href;
    } catch (error) {
      return "";
    }
  }

  const adminUrl = withAdminPage(configuredUrl || publicJsonpUrl);
  if (!adminUrl) {
    status.textContent = "The admin console link has not been configured. / 管理画面へのリンクが設定されていません。";
    link.removeAttribute("href");
    link.tabIndex = -1;
    return;
  }

  link.href = adminUrl;
  link.removeAttribute("aria-disabled");
  link.removeAttribute("tabindex");
  status.textContent = "When prompted, sign in with an authorized Google account. / 画面の案内に従い、許可されたGoogleアカウントでログインしてください。";
})();
