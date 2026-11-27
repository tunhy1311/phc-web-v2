/* US07 Customer view: record per-booking communication preferences; preview only. */
(function () {
  "use strict";
  var root = document.getElementById("notification-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;
  var params = new URLSearchParams(window.location.search);
  var bookingId = params.get("booking");
  var session = PHCStore.session();

  function bookingsForCustomer() {
    var s = PHCStore.session();
    return (PHCStore.get("bookings") || []).filter(function (b) {
      return PHCNotifications.belongsToCustomer(b, s);
    });
  }
  function customer() {
    var s = PHCStore.session();
    return (PHCStore.get("customers") || []).find(function (c) { return s && c.id === s.id; }) || null;
  }
  function findBooking(id) {
    return bookingsForCustomer().find(function (b) { return String(b.id) === String(id); }) || null;
  }
  function showUnavailable() {
    var s = PHCStore.session();
    if (!s || s.role !== "customer") {
      root.innerHTML = '<div class="card stack"><h2>Sign in required</h2>' +
        '<p>Sign in as the customer who made the booking to choose notification preferences.</p>' +
        '<a class="btn btn-primary" href="' + esc(PHCUI.url("customer/login.html") + "?next=" + encodeURIComponent("notifications.html?booking=" + (bookingId || ""))) + '">Sign in</a></div>';
      return;
    }
    root.innerHTML = '<div class="card stack"><h2>No eligible booking selected</h2>' +
      '<p>Only your active bookings can have notification preferences. Cancelled or other customers\' bookings cannot be edited.</p>' +
      '<p><a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">My bookings</a></p></div>';
  }
  function showPicker() {
    var list = bookingsForCustomer();
    if (!list.length) return showUnavailable();
    root.innerHTML = '<section class="card stack"><h2>Choose your booking</h2>' +
      '<label class="field"><span>Booking</span><select id="notice-booking">' + list.map(function (b) {
        return '<option value="' + esc(b.id) + '">' + esc(b.serviceName + " – " + b.id) + '</option>';
      }).join("") + '</select></label><button type="button" class="btn btn-primary" id="notice-select">Continue</button></section>';
    root.querySelector("#notice-select").addEventListener("click", function () {
      window.location.href = PHCUI.url("customer/notifications.html") + "?booking=" + encodeURIComponent(root.querySelector("#notice-booking").value);
    });
  }
  function showForm(b) {
    var c = customer();
    var prior = b.notification || {};
    var method = prior.method || "email";
    var phone = prior.phone || (c && c.phone) || "";
    root.innerHTML =
      '<section class="card stack notice-card" aria-labelledby="notify-heading">' +
        '<div class="notice-badge">Step: Notification preferences</div>' +
        '<h2 id="notify-heading">Booking ' + esc(String(b.id).toUpperCase()) + '</h2>' +
        '<p class="muted">' + esc(b.serviceName || "Journey") + " · " + esc(b.pickup || "") + " → " + esc(b.destination || "") + '</p>' +
        '<form id="notification-form" novalidate class="stack">' +
          '<fieldset class="notice-methods"><legend>Choose how we contact you</legend>' +
            '<div class="notice-options">' +
              '<label class="notice-choice"><input type="radio" name="method" value="email"' + (method === "email" ? ' checked' : '') + '><span><strong>✉ Email</strong><small>Confirmation and arrival email preview</small></span></label>' +
              '<label class="notice-choice"><input type="radio" name="method" value="text"' + (method === "text" ? ' checked' : '') + '><span><strong>▤ Text</strong><small>Confirmation and arrival SMS preview</small></span></label>' +
              '<label class="notice-choice"><input type="radio" name="method" value="both"' + (method === "both" ? ' checked' : '') + '><span><strong>✓ Both</strong><small>Receive both previews</small></span></label>' +
            '</div><p id="method-error" class="error" role="alert"></p></fieldset>' +
          '<div class="notice-contact"><p class="notice-email"><strong>Email address</strong><span>' + esc(c ? c.email : "Not found") + '</span></p>' +
          '<label class="field" for="notice-phone" id="phone-field">UK mobile number (11 digits)<input id="notice-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="07123 456789" value="' + esc(phone) + '"><small class="muted">Spaces are allowed. Text/Both requires 11 digits beginning with 0.</small></label>' +
          '<p class="error" id="phone-error" role="alert"></p></div>' +
          '<div class="actions"><button class="btn btn-primary" type="submit">Save and confirm notifications</button><a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">My bookings</a></div>' +
          '<p class="muted notice-footnote">Prototype only: no real email or SMS will be sent.</p>' +
        '</form></section>';
    var form = root.querySelector("#notification-form");
    var phoneInput = root.querySelector("#notice-phone");
    function updateMethod() {
      var chosen = form.querySelector('input[name="method"]:checked');
      var textNeeded = !!chosen && PHCNotifications.channels(chosen.value).indexOf("text") >= 0;
      root.querySelector("#phone-field").hidden = !textNeeded;
      root.querySelector("#phone-error").textContent = "";
      phoneInput.setAttribute("aria-invalid", "false");
      Array.prototype.forEach.call(form.querySelectorAll(".notice-choice"), function (node) {
        node.classList.toggle("selected", node.querySelector("input").checked);
      });
    }
    form.addEventListener("change", updateMethod);
    updateMethod();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var chosen = form.querySelector('input[name="method"]:checked');
      var result = PHCNotifications.savePreference(findBooking(b.id), chosen ? chosen.value : "", phoneInput.value);
      root.querySelector("#method-error").textContent = result.errors && result.errors.method || "";
      root.querySelector("#phone-error").textContent = result.errors && result.errors.phone || "";
      phoneInput.setAttribute("aria-invalid", result.errors && result.errors.phone ? "true" : "false");
      if (!result.ok) return;
      PHCStore.update("bookings", function (list) {
        return (list || []).map(function (item) { return item.id === b.id ? result.booking : item; });
      });
      showConfirmation(result.booking);
    });
  }
  function showConfirmation(b) {
    var c = customer(), method = b.notification.method, labels = { email: "Email", text: "Text", both: "Email and Text" };
    var isEmail = PHCNotifications.channels(method).indexOf("email") >= 0;
    var isText = PHCNotifications.channels(method).indexOf("text") >= 0;
    var isPaid = PHCNotifications.confirmedBooking(b);
    var bookingMessage = isPaid
      ? "Your " + (b.serviceName || "journey") + " booking is confirmed."
      : "Your " + (b.serviceName || "journey") + " booking is saved and awaiting payment.";
    var emailMessage = bookingMessage + " Reference: " + b.id + ".";
    var textMessage = "PHC: Booking " + b.id + (isPaid ? " is confirmed." : " is awaiting payment.");
    root.innerHTML =
      '<section class="card notice-success stack"><span class="notice-success-icon" aria-hidden="true">✓</span>' +
      '<h2>Notification preference saved: ' + esc(labels[method]) + '</h2>' +
      '<p class="success">Your notification preference has been saved for booking <strong>' + esc(String(b.id).toUpperCase()) + '</strong>.</p>' +
      (isPaid ? '<p>Your booking is confirmed.</p>' : '<p class="notice-warning">Your booking is awaiting payment. Complete payment to confirm your booking.</p>') +
      '<p class="muted">Prototype preview only. No real email or text message has been sent.</p>' +
      '<div class="notice-preview-grid">' +
        (isEmail ? '<section class="notice-preview"><h3>Email preview</h3><p><strong>To:</strong> ' + esc(c ? c.email : "") + '</p><p>' + esc(emailMessage) + '</p></section>' : '') +
        (isText ? '<section class="notice-preview"><h3>Text preview</h3><p><strong>To:</strong> ' + esc(b.notification.phone) + '</p><p>' + esc(textMessage) + '</p></section>' : '') +
      '</div>' +
      '<div class="actions">' +
      (!isPaid ? '<a class="btn btn-primary" href="' + esc(PHCUI.url("customer/payment.html") + "?booking=" + encodeURIComponent(b.id)) + '">Continue to payment</a>' : '') +
      '<button id="change-notifications" class="btn btn-ghost" type="button">Edit preference</button>' +
      '<a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">My bookings</a></div></section>';
    root.querySelector("#change-notifications").addEventListener("click", function () { showForm(findBooking(b.id) || b); });
  }
  if (!session || session.role !== "customer") showUnavailable();
  else if (bookingId) {
    var found = findBooking(bookingId);
    if (found) showForm(found);
    else showUnavailable();
  } else showPicker();
})();
