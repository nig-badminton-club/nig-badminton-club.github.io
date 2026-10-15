(function () {
  const { loadData, validateData, safeHref } = window.NigBadmintonPublic;
  const status = document.getElementById("membership-status");
  const link = document.getElementById("membership-form-link");

  loadData()
    .then((data) => {
      validateData(data);
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
      status.textContent = "Use the Google Form to join or leave the club, update your registered email address, or contact the managers. Google sign-in is required so the request can be verified. / Googleフォームから、入会・退会・登録メールアドレス変更・管理者への連絡を行えます。申請内容の確認のため、Googleへのログインが必要です。";
    })
    .catch((error) => {
      console.error(error);
      status.textContent = "The membership form is currently unavailable. Please try again later. / 現在、メンバー手続きフォームを利用できません。時間をおいて再度お試しください。";
    });
})();
