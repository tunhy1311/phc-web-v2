/*
 * US10 - My bookings: view, cancel or amend a booking (PHC-25). Owner: Huy.
 * Fills #page-root on customer/my-bookings.html.
 * Load after: data.js, store.js, ui.js, validators.js, rules.js, auth.js, booking-changes.js, receipt-rules.js.
 *
 * All rules live in PHCBookingChanges (pure functions, unit tested). This file only draws the page
 * and saves the result with PHCStore.update("bookings", ...).
 *
 * Flows (acceptance criteria of PHC-25):
 *   Cancel: Cancel button -> 24h check -> confirmation question -> status "cancelled" -> cancellation email screen.
 *   Amend:  Amend button  -> 24h check -> form (date, time, car size) -> review with the recalculated price
 *           (15% online discount included) -> confirm -> the updated booking is shown in the list.
 *   A change inside the 24h window is refused with an explanation of the 24-hour rule.
 * The prototype sends no real email: the cancellation screen only says that one has been sent.
 */
(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;
  var customer = PHCAuth.requireCustomer("my-bookings.html");
  if (!customer) return;

  root.classList.remove("placeholder");

  // ---------- helpers ----------

  function money(n) {
    return "£" + Number(n).toFixed(2);
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function formatPickup(pickupAt) {
    return new Date(pickupAt).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function dateOf(pickupAt) {
    var d = new Date(pickupAt);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function timeOf(pickupAt) {
    var d = new Date(pickupAt);
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function todayLocal() {
    return dateOf(new Date().toISOString());
  }

  function myBookings() {
    return (PHCStore.get("bookings") || [])
      .filter(function (b) { return b.customerId === customer.id; })
      .sort(function (a, b) { return new Date(a.pickupAt) - new Date(b.pickupAt); });
  }

  function findBooking(id) {
    return myBookings().filter(function (b) { return b.id === id; })[0] || null;
  }

  function saveBooking(updated) {
    PHCStore.update("bookings", function (list) {
      return (list || []).map(function (b) { return b.id === updated.id ? updated : b; });
    });
  }

  function statusBadge(b) {
    var label = PHCBookingChanges.statusLabel(b);
    var cls = label === "Confirmed" ? "badge-available" : "badge-busy";
    return '<span class="badge ' + cls + '">' + label + "</span>";
  }

  function sizeOption(size, text, selected) {
    var checked = Number(size) === Number(selected);
    return (
      '<label class="choice size-choice' + (checked ? " selected" : "") + '">' +
        '<input type="radio" name="carSize" value="' + size + '"' + (checked ? " checked" : "") + ">" +
        "<span><strong>" + size + "-seater</strong>" +
        '<span class="muted size-text">' + esc(text) + "</span></span>" +
      "</label>"
    );
  }

  // ---------- list ----------

  function receiptLink(b) {
    if (!PHCReceipt.canView(b, { role: "customer", id: customer.id }).ok) return "";
    return '<a class="btn btn-ghost btn-sm" id="receipt-' + esc(b.id) + '" href="' +
      esc(PHCUI.url("customer/receipt.html") + "?booking=" + encodeURIComponent(b.id)) + '">View receipt</a>';
  }

  function bookingCard(b) {
    var cancelled = b.status === "cancelled";
    return (
      '<article class="card booking-card" data-id="' + esc(b.id) + '" aria-label="Booking to ' + esc(b.destination) + '">' +
        '<div class="booking-head">' +
          "<h2>" + esc(b.serviceName) + "</h2>" + statusBadge(b) +
        "</div>" +
        '<dl class="summary-list">' +
          "<div><dt>Pick-up time</dt><dd>" + esc(formatPickup(b.pickupAt)) + "</dd></div>" +
          "<div><dt>From</dt><dd>" + esc(b.pickup) + "</dd></div>" +
          "<div><dt>To</dt><dd>" + esc(b.destination) + "</dd></div>" +
          "<div><dt>Passengers and car</dt><dd>" + esc(String(b.passengers)) + " passengers, " + esc(String(b.carSize)) + "-seater</dd></div>" +
          "<div><dt>Total</dt><dd>" + money(b.total) + "</dd></div>" +
        "</dl>" +
        (cancelled
          ? '<p class="muted">This booking was cancelled.</p>'
          : '<div class="actions">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-act="amend" id="amend-' + esc(b.id) + '">Amend</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-act="cancel" id="cancel-' + esc(b.id) + '">Cancel booking</button>' +
              receiptLink(b) +
              '<a class="btn btn-ghost btn-sm" href="' + esc(PHCUI.url("customer/notifications.html") + "?booking=" + encodeURIComponent(b.id)) + '">Notifications</a>' +
            "</div>") +
        '<div class="booking-panel" data-panel></div>' +
      "</article>"
    );
  }

  function renderList(message) {
    var list = myBookings();
    var html = '<div id="changes-status" class="success" role="status" aria-live="polite">' + esc(message || "") + "</div>";
    if (!list.length) {
      html += '<div class="card"><p>You have no bookings yet.</p>' +
        '<p><a class="btn btn-primary" href="' + esc(PHCUI.url("customer/book.html")) + '">Book a car</a></p></div>';
    } else {
      html += '<div class="stack">' + list.map(bookingCard).join("") + "</div>";
    }
    root.innerHTML = html;
  }

  function panelOf(card) {
    return card.querySelector("[data-panel]");
  }

  function refusal(card, reason) {
    panelOf(card).innerHTML = '<p class="error" role="alert">' + esc(reason) + "</p>";
  }

  // ---------- cancel ----------

  function startCancel(card, button) {
    var b = findBooking(card.getAttribute("data-id"));
    var check = PHCBookingChanges.checkChange(b, new Date());
    if (!check.allowed) return refusal(card, check.reason);
    panelOf(card).innerHTML = "";
    PHCUI.confirmInline(button, {
      message: "Cancel your booking on " + formatPickup(b.pickupAt) + "? This cannot be undone.",
      confirmLabel: "Yes, cancel booking",
      cancelLabel: "Keep booking",
      onConfirm: function () { finishCancel(b.id); }
    });
  }

  function finishCancel(id) {
    var b = findBooking(id);
    var result = PHCBookingChanges.cancelBooking(b, new Date()); // checked again: time may have passed
    if (!result.ok) {
      renderList("");
      var card = root.querySelector('[data-id="' + id + '"]');
      if (card) refusal(card, result.error);
      return;
    }
    saveBooking(result.booking);
    renderCancelled(result.booking);
  }

  function renderCancelled(b) {
    root.innerHTML =
      '<div class="card stack" id="cancel-done">' +
        '<h2 tabindex="-1" id="cancel-heading">Booking cancelled</h2>' +
        '<p class="success" role="status">A cancellation email has been sent to ' + esc(customer.email) + ".</p>" +
        '<p class="muted">Prototype: no real email is sent.</p>' +
        '<dl class="summary-list">' +
          "<div><dt>Booking</dt><dd>" + esc(b.serviceName) + "</dd></div>" +
          "<div><dt>Pick-up time</dt><dd>" + esc(formatPickup(b.pickupAt)) + "</dd></div>" +
          "<div><dt>Status</dt><dd>Cancelled</dd></div>" +
        "</dl>" +
        '<p><button type="button" class="btn btn-primary" id="back-to-list">Back to My bookings</button></p>' +
      "</div>";
    root.querySelector("#cancel-heading").focus();
    root.querySelector("#back-to-list").addEventListener("click", function () { renderList(""); });
  }

  // ---------- amend ----------

  function startAmend(card) {
    var b = findBooking(card.getAttribute("data-id"));
    var check = PHCBookingChanges.checkChange(b, new Date());
    if (!check.allowed) return refusal(card, check.reason);
    panelOf(card).innerHTML =
      '<form class="amend-form stack" novalidate aria-label="Amend booking">' +
        "<h3>Amend booking</h3>" +
        '<p class="muted">You can change the pick-up date, time and car size. Other changes: please call us.</p>' +
        '<div class="field-row">' +
          '<div class="field"><label for="am-date-' + esc(b.id) + '">Date</label>' +
            '<input id="am-date-' + esc(b.id) + '" name="date" type="date" min="' + todayLocal() + '" value="' + esc(dateOf(b.pickupAt)) + '"></div>' +
          '<div class="field"><label for="am-time-' + esc(b.id) + '">Time</label>' +
            '<input id="am-time-' + esc(b.id) + '" name="time" type="time" value="' + esc(timeOf(b.pickupAt)) + '"></div>' +
        "</div>" +
        '<fieldset class="field"><legend>Car size</legend>' +
          '<div class="size-options" role="radiogroup" aria-label="Car size">' +
            sizeOption(4, "Up to 4 passengers, 2 large cases", b.carSize) +
            sizeOption(7, "Up to 7 passengers, 4 large cases", b.carSize) +
          "</div></fieldset>" +
        '<p class="error" data-error role="alert"></p>' +
        '<div class="actions">' +
          '<button type="submit" class="btn btn-primary btn-sm">Review changes</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="close-panel">Close</button>' +
        "</div>" +
      "</form>";
    var form = panelOf(card).querySelector("form");
    form.addEventListener("change", function () {
      Array.prototype.forEach.call(form.querySelectorAll(".size-choice"), function (l) {
        l.classList.toggle("selected", l.querySelector("input").checked);
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      reviewAmend(card, b.id, form);
    });
    form.querySelector("input").focus();
  }

  function readForm(form) {
    var size = form.querySelector('input[name="carSize"]:checked');
    return {
      date: form.elements.date.value,
      time: form.elements.time.value,
      carSize: size ? size.value : ""
    };
  }

  function reviewAmend(card, id, form) {
    var b = findBooking(id);
    var changes = readForm(form);
    var result = PHCBookingChanges.amendBooking(b, changes, new Date());
    var errBox = form.querySelector("[data-error]");
    if (!result.ok) {
      errBox.textContent = result.errors.form || result.errors.date || result.errors.time || result.errors.carSize || "Please check your changes.";
      return;
    }
    var nb = result.booking;
    panelOf(card).innerHTML =
      '<div class="stack" id="amend-review-' + esc(id) + '">' +
        "<h3>Check your changes</h3>" +
        '<dl class="summary-list price-list">' +
          "<div><dt>Pick-up time</dt><dd>" + esc(formatPickup(b.pickupAt)) + " &rarr; " + esc(formatPickup(nb.pickupAt)) + "</dd></div>" +
          "<div><dt>Car size</dt><dd>" + esc(String(b.carSize)) + "-seater &rarr; " + esc(String(nb.carSize)) + "-seater</dd></div>" +
          "<div><dt>Base fare</dt><dd>" + money(result.price.base) + "</dd></div>" +
          (result.price.discount > 0 ? "<div><dt>Online discount (15%)</dt><dd>-" + money(result.price.discount) + "</dd></div>" : "") +
          '<div class="total"><dt>New total</dt><dd>' + money(result.price.total) + "</dd></div>" +
          "<div><dt>Previous total</dt><dd>" + money(result.previousTotal) + "</dd></div>" +
        "</dl>" +
        '<p class="error" data-error role="alert"></p>' +
        '<div class="actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-act="confirm-amend">Confirm changes</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="edit-amend">Edit changes</button>' +
        "</div>" +
      "</div>";
    var review = panelOf(card);
    review.querySelector('[data-act="edit-amend"]').addEventListener("click", function () {
      startAmend(card);
    });
    review.querySelector('[data-act="confirm-amend"]').addEventListener("click", function () {
      var again = PHCBookingChanges.amendBooking(findBooking(id), changes, new Date()); // checked again
      if (!again.ok) {
        review.querySelector("[data-error]").textContent =
          again.errors.form || again.errors.date || again.errors.time || again.errors.carSize || "These changes are no longer valid.";
        return;
      }
      saveBooking(again.booking);
      renderList("Booking updated. Your changes are shown below.");
      var updatedCard = root.querySelector('[data-id="' + id + '"]');
      if (updatedCard) updatedCard.classList.add("booking-updated");
    });
    review.querySelector('[data-act="confirm-amend"]').focus();
  }

  // ---------- events ----------

  root.addEventListener("click", function (e) {
    var target = e.target.closest("button[data-act]");
    if (!target) return;
    var card = target.closest(".booking-card");
    if (!card) return;
    var act = target.getAttribute("data-act");
    if (act === "cancel") startCancel(card, target);
    else if (act === "amend") startAmend(card);
    else if (act === "close-panel") panelOf(card).innerHTML = "";
  });

  renderList("");
})();
