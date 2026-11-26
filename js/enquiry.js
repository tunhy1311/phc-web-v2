/*
 * US03 - Send a general enquiry or an enquiry about a specific trip (PHC-18). Owner: Phúc Nguyễn.
 * Fills #page-root on customer/enquiry.html.
 * Load after: data.js, store.js, ui.js, validators.js, auth.js, enquiry-rules.js.
 *
 * Acceptance criteria of PHC-18:
 *   Type: 'General' or 'About a booking' (radio cards). enquiry.html?type=booking preselects the second.
 *   About a booking + signed in: pick one of your bookings from a list.
 *   About a booking + signed out: sent to login.html?next=enquiry.html?type=booking, and back here after login.
 *   Empty message: 'Enter your message' next to the field, nothing saved.
 *   Valid: saved to state.enquiries with status "open", confirmation shows the ENQ-###### reference.
 *   'My enquiries' (customer/my-enquiries.html) lists it with status 'Open'.
 * A guest may send a General enquiry with a name and email address; it has no 'My enquiries' list.
 */
(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;
  var BOOKING_NEXT = "enquiry.html?type=booking";

  var shownFor = null; // the session the page was last drawn for, as sessionKey()

  function sessionKey() {
    var s = PHCStore.session();
    return s ? s.role + ":" + s.id : "";
  }

  function startType() {
    return new URLSearchParams(window.location.search).get("type") === "booking" ? "booking" : "general";
  }

  function myBookings(customer) {
    return (PHCStore.get("bookings") || [])
      .filter(function (b) { return b.customerId === customer.id; })
      .sort(function (a, b) { return new Date(b.pickupAt) - new Date(a.pickupAt); });
  }

  function typeOption(value, hint, checked) {
    return (
      '<label class="choice size-choice' + (checked ? " selected" : "") + '">' +
        '<input type="radio" name="type" value="' + value + '"' + (checked ? " checked" : "") + ">" +
        "<span><strong>" + esc(PHCEnquiry.TYPES[value]) + "</strong>" +
        '<span class="muted size-text">' + esc(hint) + "</span></span>" +
      "</label>"
    );
  }

  function bookingField(customer, type) {
    if (type !== "booking" || !customer) return "";
    var list = myBookings(customer);
    if (!list.length) {
      return (
        '<div class="field"><label for="enq-booking">Booking</label>' +
          '<select id="enq-booking" name="bookingId" disabled><option value="">No bookings yet</option></select>' +
          '<p class="hint">You have no bookings yet. <a href="' + esc(PHCUI.url("customer/book.html")) + '">Book a car</a> or choose General.</p>' +
        "</div>"
      );
    }
    return (
      '<div class="field"><label for="enq-booking">Booking</label>' +
        '<select id="enq-booking" name="bookingId">' +
          '<option value="">Choose a booking</option>' +
          list.map(function (b) {
            return '<option value="' + esc(b.id) + '">' + esc(PHCEnquiry.bookingLabel(b)) + "</option>";
          }).join("") +
        "</select>" +
      "</div>"
    );
  }

  function senderFields(customer) {
    if (customer) {
      return '<p class="muted" id="enq-sender">Sending as ' + esc(customer.name) + " (" + esc(customer.email) + ")</p>";
    }
    return (
      '<div class="field-row">' +
        '<div class="field"><label for="enq-name">Your name</label>' +
          '<input id="enq-name" name="name" type="text" autocomplete="name"></div>' +
        '<div class="field"><label for="enq-email">Email address</label>' +
          '<input id="enq-email" name="email" type="email" autocomplete="email"></div>' +
      "</div>" +
      '<p class="hint">We reply by email. <a href="' + esc(PHCUI.url("customer/login.html") + "?next=enquiry.html") + '">Sign in</a> to see your enquiries in My enquiries.</p>'
    );
  }

  function render(type, keep) {
    var customer = PHCAuth.currentCustomer();
    if (type === "booking" && !customer) {
      PHCAuth.requireCustomer(BOOKING_NEXT);
      return;
    }
    shownFor = sessionKey();
    root.classList.remove("placeholder");
    root.classList.add("card");
    root.innerHTML =
      '<form id="enquiry-form" class="form" novalidate>' +
        '<fieldset class="field"><legend>Type of enquiry</legend>' +
          '<div class="size-options" id="enq-type">' +
            typeOption("general", "Quotes, prices, lost property or anything else.", type === "general") +
            typeOption("booking", "A question about one of your trips.", type === "booking") +
          "</div>" +
        "</fieldset>" +
        bookingField(customer, type) +
        senderFields(customer) +
        '<div class="field"><label for="enq-message">Message</label>' +
          '<textarea id="enq-message" name="message"></textarea></div>' +
        '<div class="actions"><button class="btn btn-primary" type="submit">Send enquiry</button></div>' +
      "</form>";

    var form = root.querySelector("#enquiry-form");
    // Changing the type redraws the form, so keep what was already typed.
    if (keep) {
      ["message", "name", "email"].forEach(function (k) {
        if (form.elements[k] && keep[k]) form.elements[k].value = keep[k];
      });
    }
    Array.prototype.forEach.call(form.elements.type, function (radio) {
      radio.addEventListener("change", function () {
        render(radio.value, { message: valueOf(form, "message"), name: valueOf(form, "name"), email: valueOf(form, "email") });
      });
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      submit(form, customer);
    });
  }

  function valueOf(form, name) {
    return form.elements[name] ? form.elements[name].value : "";
  }

  function submit(form, customer) {
    var fields = { type: form.querySelector("#enq-type"), bookingId: form.elements.bookingId,
      name: form.elements.name, email: form.elements.email, message: form.elements.message };
    Object.keys(fields).forEach(function (k) { if (fields[k]) PHCUI.clearFieldError(fields[k]); });

    var type = form.querySelector('input[name="type"]:checked').value;
    var enquiries = PHCStore.get("enquiries") || [];
    var result = PHCEnquiry.createEnquiry({
      type: type,
      message: valueOf(form, "message"),
      customerId: customer ? customer.id : null,
      bookingId: valueOf(form, "bookingId"),
      bookingIds: customer ? myBookings(customer).map(function (b) { return b.id; }) : [],
      name: valueOf(form, "name"),
      email: valueOf(form, "email")
    }, enquiries, Date.now());

    if (!result.ok) {
      var first = null;
      ["type", "bookingId", "name", "email", "message"].forEach(function (k) {
        if (result.errors[k] && fields[k]) {
          PHCUI.setFieldError(fields[k], result.errors[k]);
          first = first || fields[k];
        }
      });
      if (first && first.focus) first.focus();
      return;
    }

    PHCStore.update("enquiries", function (list) {
      list = Array.isArray(list) ? list : [];
      list.push(result.enquiry);
      return list;
    });
    renderSent(result.enquiry, customer);
  }

  function renderSent(e, customer) {
    var booking = e.bookingId
      ? (PHCStore.get("bookings") || []).filter(function (b) { return b.id === e.bookingId; })[0]
      : null;
    root.innerHTML =
      '<div class="stack" id="enquiry-sent">' +
        '<h2 tabindex="-1" id="sent-heading">Enquiry sent</h2>' +
        '<p class="success" role="status">Your reference is <strong id="enq-reference">' + esc(e.reference) + "</strong>.</p>" +
        '<dl class="summary-list">' +
          "<div><dt>Reference</dt><dd>" + esc(e.reference) + "</dd></div>" +
          "<div><dt>Type</dt><dd>" + esc(PHCEnquiry.TYPES[e.type]) + "</dd></div>" +
          (booking ? "<div><dt>Booking</dt><dd>" + esc(PHCEnquiry.bookingLabel(booking)) + "</dd></div>" : "") +
          "<div><dt>Status</dt><dd>" + esc(PHCEnquiry.statusLabel(e)) + "</dd></div>" +
        "</dl>" +
        '<p class="muted">' + (customer
          ? "We will reply in My enquiries and by email to " + esc(customer.email) + "."
          : "Keep this reference. We will reply by email to " + esc(e.email) + ".") +
          " Prototype: no real email is sent.</p>" +
        '<div class="actions">' +
          (customer ? '<a class="btn btn-primary" id="to-my-enquiries" href="my-enquiries.html">My enquiries</a>' : "") +
          '<button type="button" class="btn btn-ghost" id="send-another">Send another enquiry</button>' +
        "</div>" +
      "</div>";
    // The form was scrolled down to the Send button; start the confirmation at the top of the
    // page so the sticky header does not cover it on a phone.
    window.scrollTo(0, 0);
    root.querySelector("#sent-heading").focus({ preventScroll: true });
    root.querySelector("#send-another").addEventListener("click", function () { render("general"); });
  }

  // ui.js fires this for ANY change another tab makes to the shared state, for example an
  // enquiry sent there. Redraw only when the signed-in user really changed, and keep what was
  // typed; otherwise leave the form (or the confirmation) as it is (PR #18 review).
  document.addEventListener("phc:session-change", function () {
    var form = root.querySelector("#enquiry-form");
    var checked = form && form.querySelector('input[name="type"]:checked');
    var type = PHCEnquiry.redrawType(shownFor, sessionKey(), checked ? checked.value : "general",
      Boolean(PHCAuth.currentCustomer()));
    if (!type) return;
    render(type, form ? { message: valueOf(form, "message"), name: valueOf(form, "name"), email: valueOf(form, "email") } : null);
  });
  document.addEventListener("phc:reset", function () { render("general"); });

  render(startType());
})();
