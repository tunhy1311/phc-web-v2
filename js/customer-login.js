/* PHC-15 (US02) page script for customer/login.html: sign in, locked, profile, sign out. Owner: Huy. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  var params = new URLSearchParams(window.location.search);

  // Only allow a same-folder page name such as "book.html" as the redirect target.
  function safeNext() {
    var n = params.get("next") || "my-bookings.html";
    return /^[a-z0-9_\-]+\.html(\?[^#]*)?$/i.test(n) ? n : "my-bookings.html";
  }

  function show(view) {
    ["view-login", "view-locked", "view-profile"].forEach(function (id) {
      $(id).hidden = id !== view;
    });
  }

  function clearErrors() {
    Array.prototype.forEach.call(document.querySelectorAll("#page-root .error"), function (el) {
      el.textContent = "";
    });
    $("profile-ok").textContent = "";
  }

  function fillProfile(c) {
    $("p-email").value = c.email;
    $("p-name").value = c.name || "";
    $("p-phone").value = c.phone || "";
    $("p-address").value = c.address || "";
    $("welcome").textContent = "Signed in as " + (c.name || c.email);
  }

  function showForSession() {
    var c = PHCAuth.currentCustomer();
    if (c) { fillProfile(c); show("view-profile"); } else { show("view-login"); }
  }

  $("login-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    clearErrors();
    var email = $("l-email").value;
    var password = $("l-password").value;
    if (!email.trim()) { $("err-l-email").textContent = "Please enter your email"; $("l-email").focus(); return; }
    if (!password) { $("err-l-password").textContent = "Please enter your password"; $("l-password").focus(); return; }

    var r = PHCAuth.login(email, password);
    if (r.ok) {
      PHCUI.renderHeader();
      window.location.href = safeNext();
      return;
    }
    $("l-password").value = "";
    if (r.locked) { show("view-locked"); return; }
    $("err-login").textContent = r.error;
    $("l-password").focus();
  });

  $("profile-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    clearErrors();
    var c = PHCAuth.currentCustomer();
    if (!c) { show("view-login"); return; }
    var r = PHCAuth.updateProfile(c.id, {
      name: $("p-name").value,
      phone: $("p-phone").value,
      address: $("p-address").value
    });
    if (!r.ok) {
      ["name", "phone", "address"].forEach(function (k) {
        if (r.errors[k]) $("err-p-" + k).textContent = r.errors[k];
      });
      if (r.errors.form) $("err-profile").textContent = r.errors.form;
      return;
    }
    PHCUI.renderHeader();
    fillProfile(PHCAuth.currentCustomer());
    $("profile-ok").textContent = "Profile updated";
  });

  $("logout-btn").addEventListener("click", function () {
    PHCAuth.logout();
    PHCUI.renderHeader();
    window.location.href = "../index.html";
  });

  $("back-to-login").addEventListener("click", function () { clearErrors(); show("view-login"); });

  $("reset-link").addEventListener("click", function (ev) {
    ev.preventDefault();
    $("reset-msg").textContent = "Simulated: a password reset link has been sent to your email (prototype only).";
  });

  // Header "Sign out" button or another tab changed the session.
  document.addEventListener("phc:session-change", showForSession);
  document.addEventListener("phc:reset", showForSession);

  showForSession();
})();
