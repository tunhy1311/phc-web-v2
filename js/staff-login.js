(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function safeNext() {
    var n = (new URLSearchParams(window.location.search).get("next") || "").replace(/^staff\//, "");
    return /^[a-z0-9_\-]+\.html(\?[^#]*)?$/i.test(n) ? n : "new-booking.html";
  }

  function show() {
    var staff = PHCStaffAuth.current();
    $("view-login").hidden = !!staff;
    $("view-signed-in").hidden = !staff;
    if (staff) $("staff-welcome").textContent = "Signed in as " + staff.name + " (" + staff.email + ")";
  }

  $("staff-login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("s-email");
    var password = $("s-password");
    var error = $("err-staff-login");
    error.textContent = "";
    PHCUI.clearFieldError(email);
    PHCUI.clearFieldError(password);
    if (!email.value.trim()) {
      PHCUI.setFieldError(email, "Enter your work email");
      email.focus();
      return;
    }
    if (!password.value) {
      PHCUI.setFieldError(password, "Enter your password");
      password.focus();
      return;
    }
    var r = PHCStaffAuth.login(email.value, password.value);
    if (!r.ok) {
      password.value = "";
      error.textContent = r.error;
      password.focus();
      return;
    }
    PHCUI.renderHeader();
    window.location.href = safeNext();
  });

  document.addEventListener("phc:session-change", show);
  document.addEventListener("phc:reset", show);
  show();
})();
