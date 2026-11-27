/*
 * PHCUI - shared header/footer and small UI helpers.
 * Load order on every page: js/data.js, js/store.js, js/ui.js (then your page script).
 *
 * Each page's <body> sets:
 *   data-root  relative path to the site root: "." for index.html, ".." for customer/* staff/* tests/*
 *   data-area  "home" | "customer" | "staff" | "tests"  (staff pages also get the staff sub-menu)
 * and contains <main id="main" class="container">.
 *
 * Helpers for the team:
 *   PHCUI.url("customer/book.html")    -> correct relative link from any page
 *   PHCUI.escapeHtml(text)             -> safe text for innerHTML
 *   PHCUI.confirmInline(afterEl, {message, confirmLabel, cancelLabel, onConfirm, onCancel})
 *                                      -> in-page confirmation (never use alert/confirm/prompt)
 *   PHCUI.setFieldError(input, msg) / PHCUI.clearFieldError(input)
 *                                      -> error message shown right next to the field
 *   PHCUI.renderHeader()               -> call after you change the session (e.g. after login)
 *
 * Events dispatched on document:
 *   "phc:reset"           after "Reset sample data"
 *   "phc:session-change"  after "Sign out" (and when another tab changes the session)
 */
var PHCUI = (function () {
  "use strict";

  var MAIN_NAV = [
    { href: "index.html", label: "Home" },
    { href: "customer/book.html", label: "Book a car" },
    { href: "customer/my-bookings.html", label: "My bookings" },
    { href: "customer/enquiry.html", label: "Enquiry" },
    { href: "staff/caller.html", label: "Staff", area: "staff" }
  ];

  var STAFF_NAV = [
    { href: "staff/caller.html", label: "Caller" },
    { href: "staff/availability.html", label: "Availability" },
    { href: "staff/new-booking.html", label: "New booking" },
    { href: "staff/bookings.html", label: "Completed journeys" },
    { href: "staff/fleet.html", label: "Fleet" },
    { href: "staff/enquiries.html", label: "Enquiries" },
    { href: "staff/insights.html", label: "Insights" }
  ];

  function root() {
    var r = (document.body && document.body.getAttribute("data-root")) || ".";
    return r.replace(/\/+$/, "") || ".";
  }

  function url(path) {
    return root() + "/" + String(path).replace(/^\/+/, "");
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalisePath(pathname) {
    return pathname.replace(/\/$/, "/index.html");
  }

  function isCurrent(href) {
    try {
      var target = new URL(url(href), window.location.href).pathname;
      return normalisePath(target) === normalisePath(window.location.pathname);
    } catch (e) {
      return false;
    }
  }

  function navLinks(items) {
    var area = document.body.getAttribute("data-area");
    return items
      .map(function (item) {
        var current = isCurrent(item.href) || (item.area && item.area === area);
        return (
          '<li><a href="' + escapeHtml(url(item.href)) + '"' +
          (current ? ' aria-current="page" class="active"' : "") +
          ">" + escapeHtml(item.label) + "</a></li>"
        );
      })
      .join("");
  }

  function accountHtml() {
    var s = PHCStore.session();
    if (s) {
      var name = "";
      if (s.role === "customer") {
        var c = (PHCStore.get("customers") || []).filter(function (x) { return x.id === s.id; })[0];
        if (c) name = c.name;
      }
      return (
        '<span class="signed-in">Signed in (' + escapeHtml(s.role) + ")" +
        (name ? ' <span class="muted">· ' + escapeHtml(name) + "</span>" : "") +
        "</span>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-phc="sign-out">Sign out</button>'
      );
    }
    return (
      '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(url("customer/login.html")) + '">Sign in</a>' +
      '<a class="btn btn-primary btn-sm" href="' + escapeHtml(url("customer/register.html")) + '">Register</a>'
    );
  }

  function renderHeader() {
    var header = document.getElementById("phc-header");
    if (!header) {
      header = document.createElement("header");
      header.id = "phc-header";
      header.className = "site-header";
      var skip = document.createElement("a");
      skip.className = "skip-link";
      skip.href = "#main";
      skip.textContent = "Skip to main content";
      document.body.insertBefore(header, document.body.firstChild);
      document.body.insertBefore(skip, header);
    }

    var isStaff = document.body.getAttribute("data-area") === "staff";
    header.innerHTML =
      '<div class="container header-inner">' +
        '<a class="logo" href="' + escapeHtml(url("index.html")) + '">' +
          '<span class="logo-mark" aria-hidden="true">PHC</span>' +
          '<span class="logo-text">PrivateHire Cars</span>' +
        "</a>" +
        '<button type="button" class="nav-toggle btn btn-ghost btn-sm" aria-expanded="false" aria-controls="phc-nav">Menu</button>' +
        '<div class="nav-panel" id="phc-nav">' +
          '<nav aria-label="Main"><ul class="nav-list">' + navLinks(MAIN_NAV) + "</ul></nav>" +
          '<div class="account">' + accountHtml() + "</div>" +
        "</div>" +
      "</div>" +
      (isStaff
        ? '<div class="subnav"><div class="container"><nav aria-label="Staff"><ul class="nav-list">' +
          navLinks(STAFF_NAV) + "</ul></nav></div></div>"
        : "");

    var toggle = header.querySelector(".nav-toggle");
    var panel = header.querySelector(".nav-panel");
    toggle.addEventListener("click", function () {
      var open = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    var signOut = header.querySelector('[data-phc="sign-out"]');
    if (signOut) {
      signOut.addEventListener("click", function () {
        PHCStore.setSession(null);
        renderHeader();
        document.dispatchEvent(new CustomEvent("phc:session-change", { detail: null }));
      });
    }
  }

  function confirmInline(afterEl, options) {
    var opts = options || {};
    var existing = afterEl.parentNode.querySelector(".inline-confirm[data-for='" + (afterEl.id || "") + "']");
    if (existing) existing.parentNode.removeChild(existing);

    var box = document.createElement("div");
    box.className = "inline-confirm";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Confirm action");
    if (afterEl.id) box.setAttribute("data-for", afterEl.id);
    box.innerHTML =
      "<p>" + escapeHtml(opts.message || "Are you sure?") + "</p>" +
      '<div class="actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-act="yes">' + escapeHtml(opts.confirmLabel || "Yes") + "</button>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="no">' + escapeHtml(opts.cancelLabel || "Cancel") + "</button>" +
      "</div>";
    afterEl.insertAdjacentElement("afterend", box);

    function close() {
      if (box.parentNode) box.parentNode.removeChild(box);
      if (afterEl.focus) afterEl.focus();
    }
    box.querySelector('[data-act="yes"]').addEventListener("click", function () {
      close();
      if (typeof opts.onConfirm === "function") opts.onConfirm();
    });
    box.querySelector('[data-act="no"]').addEventListener("click", function () {
      close();
      if (typeof opts.onCancel === "function") opts.onCancel();
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        close();
        if (typeof opts.onCancel === "function") opts.onCancel();
      }
    });
    box.querySelector('[data-act="yes"]').focus();
    return close;
  }

  function errorIdFor(input) {
    if (!input.id) input.id = "phc-field-" + Math.random().toString(36).slice(2, 8);
    return input.id + "-error";
  }

  function setFieldError(input, message) {
    var id = errorIdFor(input);
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("p");
      el.id = id;
      el.className = "error";
      el.setAttribute("aria-live", "polite");
      input.insertAdjacentElement("afterend", el);
    }
    el.textContent = message;
    input.setAttribute("aria-invalid", "true");
    var described = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
    if (described.indexOf(id) === -1) described.push(id);
    input.setAttribute("aria-describedby", described.join(" "));
  }

  function clearFieldError(input) {
    var id = errorIdFor(input);
    var el = document.getElementById(id);
    if (el) el.parentNode.removeChild(el);
    input.removeAttribute("aria-invalid");
    var described = (input.getAttribute("aria-describedby") || "").split(" ").filter(function (x) {
      return x && x !== id;
    });
    if (described.length) input.setAttribute("aria-describedby", described.join(" "));
    else input.removeAttribute("aria-describedby");
  }

  function renderFooter() {
    if (document.getElementById("phc-footer")) return;
    var footer = document.createElement("footer");
    footer.id = "phc-footer";
    footer.className = "site-footer";
    footer.innerHTML =
      '<div class="container footer-inner">' +
        '<p class="muted">PrivateHire Cars, London · COMP1807 prototype · ' +
          '<a href="' + escapeHtml(url("tests/index.html")) + '">Tests</a></p>' +
        '<div class="reset-box">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="phc-reset-btn">Reset sample data</button>' +
          '<p class="muted reset-status" id="phc-reset-status" role="status" aria-live="polite"></p>' +
        "</div>" +
      "</div>";
    document.body.appendChild(footer);

    var btn = footer.querySelector("#phc-reset-btn");
    var status = footer.querySelector("#phc-reset-status");
    btn.addEventListener("click", function () {
      status.textContent = "";
      confirmInline(btn, {
        message: "Reset all data (customers, bookings, cars, session) to the sample data?",
        confirmLabel: "Yes, reset",
        cancelLabel: "Cancel",
        onConfirm: function () {
          PHCStore.reset();
          renderHeader();
          status.textContent = "Sample data restored.";
          document.dispatchEvent(new CustomEvent("phc:reset"));
        }
      });
    });
  }

  function init() {
    renderHeader();
    renderFooter();
    window.addEventListener("storage", function (e) {
      if (e.key === PHCStore.KEY) {
        renderHeader();
        document.dispatchEvent(new CustomEvent("phc:session-change", { detail: PHCStore.session() }));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    url: url,
    escapeHtml: escapeHtml,
    renderHeader: renderHeader,
    confirmInline: confirmInline,
    setFieldError: setFieldError,
    clearFieldError: clearFieldError
  };
})();
