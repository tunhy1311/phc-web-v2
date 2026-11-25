(function () {
  "use strict";

  var root = document.getElementById("page-root");
  var esc = PHCUI.escapeHtml;
  var params = new URLSearchParams(window.location.search);
  var bookingId = params.get("booking") || "";
  var paypalResult = params.get("paypal");
  var FIELDS = { name: "#card-name", number: "#card-number", expiry: "#card-expiry", cvv: "#card-cvv" };

  if (paypalResult) {
    window.history.replaceState(null, "", window.location.pathname + "?booking=" + encodeURIComponent(bookingId));
  }

  function money(n) {
    return "£" + Number(n).toFixed(2);
  }

  function formatPickup(pickupAt) {
    return new Date(pickupAt).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function findBooking() {
    return (PHCStore.get("bookings") || []).filter(function (b) { return b.id === bookingId; })[0] || null;
  }

  function saveBooking(next) {
    PHCStore.update("bookings", function (list) {
      return (list || []).map(function (b) { return b.id === next.id ? next : b; });
    });
  }

  function focusHeading() {
    var h2 = root.querySelector("h2");
    if (!h2) return;
    h2.setAttribute("tabindex", "-1");
    h2.focus({ preventScroll: true });
    root.scrollIntoView({ block: "start" });
  }

  function nextLinks() {
    var session = PHCStore.session();
    if (session && session.role === "staff") {
      return '<a class="btn btn-ghost" href="' + esc(PHCUI.url("staff/new-booking.html")) + '">New booking</a>';
    }
    return '<a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">My bookings</a>';
  }

  function renderMessage(title, text, actions) {
    root.innerHTML =
      '<div class="card">' +
        "<h2>" + esc(title) + "</h2>" +
        "<p>" + esc(text) + "</p>" +
        '<div class="actions">' + actions + "</div>" +
      "</div>";
  }

  function renderSignIn() {
    var next = "payment.html?booking=" + bookingId;
    renderMessage("Sign in to pay", "Please sign in to pay for this booking.",
      '<a class="btn btn-primary" href="' + esc(PHCUI.url("customer/login.html") + "?next=" + encodeURIComponent(next)) + '">Sign in</a>');
  }

  function renderPaid(booking, justPaid) {
    var p = booking.payment;
    var method = !p ? "" : p.method === "paypal" ? "PayPal" : (p.brand || "Card") + " ending " + p.last4;
    root.innerHTML =
      '<div class="card" id="pay-done">' +
        '<h2 class="success">' + (justPaid ? "Payment received, booking confirmed" : "This booking is already paid") + "</h2>" +
        '<dl class="summary-list">' +
          "<div><dt>Booking reference</dt><dd>" + esc(booking.id.toUpperCase()) + "</dd></div>" +
          (p ? "<div><dt>Payment reference</dt><dd>" + esc(p.reference) + "</dd></div>" +
               "<div><dt>Paid with</dt><dd>" + esc(method) + "</dd></div>" : "") +
          "<div><dt>Amount</dt><dd>" + money(booking.total) + "</dd></div>" +
          '<div><dt>Status</dt><dd><span class="badge badge-available">Confirmed</span></dd></div>' +
        "</dl>" +
        '<div class="actions">' +
          '<a class="btn btn-primary" href="' + esc(PHCUI.url("customer/receipt.html") + "?booking=" + encodeURIComponent(booking.id)) + '">View receipt</a>' +
          nextLinks() +
        "</div>" +
      "</div>";
    if (justPaid) focusHeading();
  }

  function summaryHtml(booking) {
    return (
      '<div class="card">' +
        "<h2>Your booking</h2>" +
        '<dl class="summary-list">' +
          "<div><dt>Reference</dt><dd>" + esc(booking.id.toUpperCase()) + "</dd></div>" +
          "<div><dt>Service</dt><dd>" + esc(booking.serviceName) + "</dd></div>" +
          "<div><dt>Date and time</dt><dd>" + esc(formatPickup(booking.pickupAt)) + "</dd></div>" +
          "<div><dt>From</dt><dd>" + esc(booking.pickup) + "</dd></div>" +
          "<div><dt>To</dt><dd>" + esc(booking.destination) + "</dd></div>" +
          '<div><dt>Status</dt><dd><span class="badge badge-busy">Unpaid</span></dd></div>' +
        "</dl>" +
        '<dl class="summary-list price-list">' +
          '<div class="total"><dt>Total to pay</dt><dd>' + money(booking.total) + "</dd></div>" +
        "</dl>" +
      "</div>"
    );
  }

  function methodOption(value, title, text, checked) {
    return (
      '<label class="choice pay-method' + (checked ? " selected" : "") + '">' +
        '<input type="radio" name="method" value="' + value + '"' + (checked ? " checked" : "") + ">" +
        "<span><strong>" + esc(title) + '</strong><span class="muted pay-method-text">' + esc(text) + "</span></span>" +
      "</label>"
    );
  }

  function renderForm(booking, notice) {
    root.innerHTML =
      (notice ? '<p class="hint-box" id="pay-notice" role="status">' + esc(notice) + "</p>" : "") +
      '<div class="pay-layout">' +
        summaryHtml(booking) +
        '<div class="card">' +
          "<h2>How would you like to pay?</h2>" +
          '<fieldset class="field pay-methods-field">' +
            '<legend class="sr-only">Payment method</legend>' +
            '<div class="pay-methods">' +
              methodOption("card", "Card", "Visa, Mastercard or American Express, checked by VISA Check", true) +
              methodOption("paypal", "PayPal", "Pay with your PayPal account", false) +
            "</div>" +
          "</fieldset>" +
          '<form class="form" id="card-form" novalidate>' +
            '<div class="field">' +
              '<label for="card-name">Name on card</label>' +
              '<input id="card-name" name="name" type="text" autocomplete="cc-name" maxlength="60">' +
            "</div>" +
            '<div class="field">' +
              '<label for="card-number">Card number</label>' +
              '<input id="card-number" name="number" type="text" inputmode="numeric" autocomplete="cc-number" maxlength="23">' +
              '<p class="hint" id="card-brand" aria-live="polite"></p>' +
            "</div>" +
            '<div class="field-row">' +
              '<div class="field">' +
                '<label for="card-expiry">Expiry date</label>' +
                '<input id="card-expiry" name="expiry" type="text" inputmode="numeric" autocomplete="cc-exp" maxlength="5" placeholder="MM/YY">' +
              "</div>" +
              '<div class="field">' +
                '<label for="card-cvv">Security code</label>' +
                '<input id="card-cvv" name="cvv" type="text" inputmode="numeric" autocomplete="cc-csc" maxlength="4">' +
              "</div>" +
            "</div>" +
            '<p class="error" id="pay-error" role="alert"></p>' +
            '<div class="actions">' +
              '<button type="submit" class="btn btn-primary" id="pay-btn">Pay ' + money(booking.total) + "</button>" +
            "</div>" +
            '<p class="muted" id="pay-status" role="status"></p>' +
          "</form>" +
          '<div id="paypal-panel" class="stack" hidden>' +
            "<p>You will go to PayPal to approve the payment, then come back here.</p>" +
            '<div class="actions">' +
              '<a class="btn btn-primary" id="paypal-btn" href="' + esc("paypal.html?booking=" + encodeURIComponent(booking.id)) + '">Continue to PayPal</a>' +
            "</div>" +
          "</div>" +
          '<details class="pay-test-cards">' +
            "<summary>Test cards for this prototype</summary>" +
            "<p>Approved: 4242 4242 4242 4242 (Visa), 5555 5555 5555 4444 (Mastercard), 3782 822463 10005 (Amex). " +
            "Declined: 4000 0000 0000 0002. Use any future expiry date.</p>" +
          "</details>" +
        "</div>" +
      "</div>";

    var form = root.querySelector("#card-form");
    var panel = root.querySelector("#paypal-panel");

    root.querySelector(".pay-methods").addEventListener("change", function () {
      var method = root.querySelector('input[name="method"]:checked').value;
      Array.prototype.forEach.call(root.querySelectorAll(".pay-method"), function (label) {
        label.classList.toggle("selected", label.querySelector("input").checked);
      });
      form.hidden = method !== "card";
      panel.hidden = method !== "paypal";
    });

    form.addEventListener("input", function (e) {
      if (e.target.id === "card-number") {
        root.querySelector("#card-brand").textContent = PHCPayment.cardBrand(e.target.value);
      }
      if (e.target.id) PHCUI.clearFieldError(e.target);
      root.querySelector("#pay-error").textContent = "";
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitCard(form);
    });
  }

  function submitCard(form) {
    var values = {
      name: form.elements.name.value,
      number: form.elements.number.value,
      expiry: form.elements.expiry.value,
      cvv: form.elements.cvv.value
    };
    var result = PHCPayment.validateCard(values, new Date());
    var firstInvalid = null;
    Object.keys(FIELDS).forEach(function (key) {
      var input = form.querySelector(FIELDS[key]);
      if (result.errors[key]) {
        PHCUI.setFieldError(input, result.errors[key]);
        firstInvalid = firstInvalid || input;
      } else {
        PHCUI.clearFieldError(input);
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    var button = form.querySelector("#pay-btn");
    var status = form.querySelector("#pay-status");
    var errorBox = form.querySelector("#pay-error");
    button.disabled = true;
    errorBox.textContent = "";
    status.textContent = "Checking with VISA Check…";

    window.setTimeout(function () {
      status.textContent = "";
      var booking = findBooking();
      if (!PHCPayment.canPay(booking, PHCStore.session()).ok) {
        render();
        return;
      }
      var auth = PHCPayment.authorise(values.number);
      if (!auth.ok) {
        errorBox.textContent = auth.error;
        form.elements.cvv.value = "";
        button.disabled = false;
        form.elements.number.focus();
        return;
      }
      var paid = PHCPayment.markPaid(booking, {
        method: "card",
        brand: result.brand,
        last4: result.last4,
        paidAt: new Date().toISOString(),
        reference: PHCPayment.newReference()
      });
      saveBooking(paid);
      renderPaid(paid, true);
    }, 700);
  }

  function render(notice) {
    var booking = findBooking();
    var check = PHCPayment.canPay(booking, PHCStore.session());
    if (check.reason === "sign-in") return renderSignIn();
    if (check.reason === "not-found") {
      return renderMessage("Booking not found", "We could not find this booking.", nextLinks());
    }
    if (check.reason === "cancelled") {
      return renderMessage("This booking was cancelled", "A cancelled booking cannot be paid.", nextLinks());
    }
    if (check.reason === "paid") {
      return renderPaid(booking, paypalResult === "success" && booking.payment && booking.payment.method === "paypal");
    }
    renderForm(booking, notice);
  }

  document.addEventListener("phc:session-change", function () { render(); });
  document.addEventListener("phc:reset", function () { render(); });

  render(paypalResult === "cancel" ? "PayPal payment was cancelled. Your booking is still unpaid." : "");
  paypalResult = null;
})();
