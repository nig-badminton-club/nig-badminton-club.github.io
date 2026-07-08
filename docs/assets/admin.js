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
    status.textContent = "Admin console link is not configured. / 管理画面リンクが未設定です。";
    return;
  }

  link.href = adminUrl;
  link.removeAttribute("aria-disabled");
  status.textContent = "Sign in with an allowed Google account when prompted. / 求められたら許可済みGoogleアカウントでログインしてください。";
})();
