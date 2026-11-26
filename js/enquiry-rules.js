/*
 * PHCEnquiry - rules for customer enquiries (PHC-18 / US03). Owner: Phúc Nguyễn.
 * Pure functions: no DOM, no localStorage, no Date.now(). The page scripts (js/enquiry.js,
 * js/my-enquiries.js) read and save state.enquiries with PHCStore.
 * Load after: data.js, validators.js.
 *
 *   PHCEnquiry.TYPES                       -> {general: "General", booking: "About a booking"}
 *   PHCEnquiry.formatReference(n)          -> "ENQ-000123"
 *   PHCEnquiry.nextReference(enquiries)    -> next free reference (highest number + 1)
 *   PHCEnquiry.validate(input)             -> {ok, errors}  errors maps type, bookingId, message, name, email
 *   PHCEnquiry.createEnquiry(input, enquiries, now) -> {ok, errors, enquiry?}
 *   PHCEnquiry.statusLabel(enquiry)        -> "Open" | "Answered"
 *   PHCEnquiry.bookingLabel(booking)       -> "Airport transfer to Heathrow, Mon 1 Dec 2026, 09:00"
 *   PHCEnquiry.forCustomer(enquiries, customerId) -> that customer's enquiries, newest first
 *
 * Added by US16 (PHC-14, owner: Huy) for the staff enquiries inbox (staff/enquiries.html):
 *   PHCEnquiry.REPLY_ERROR                 -> "Enter a reply"
 *   PHCEnquiry.typeLabel(enquiry)          -> "General" | "About a booking" | "Email from PrivateHire Cars"
 *   PHCEnquiry.customerName(enquiry, customers) -> the customer's name, or the guest name, or "Unknown"
 *   PHCEnquiry.inbox(enquiries)            -> open enquiries, oldest first (the longest wait on top)
 *   PHCEnquiry.answered(enquiries)         -> answered enquiries, newest first
 *   PHCEnquiry.addReply(enquiry, message, now) -> {ok, error?, enquiry?}  empty reply: "Enter a reply", nothing saved;
 *        otherwise pushes {from:"staff", message, sentAt} to replies and sets status "answered"
 *   PHCEnquiry.createEmail(input, enquiries, customerIds, now) -> {ok, errors, enquiry?}
 *        input = {customerId, message}; saved as type "email", status "answered", so it shows in that
 *        customer's history (My enquiries) as "Email from PrivateHire Cars"
 *
 * input = {type, message, customerId|null, bookingId|null, bookingIds: [the customer's booking ids],
 *          name, email}   name and email are only needed when nobody is signed in (General enquiry).
 * The saved record is documented in js/store.js (state key "enquiries"); US16 (PHC-14) reads it.
 */
var PHCEnquiry = (function () {
  "use strict";

  var TYPES = { general: "General", booking: "About a booking" };
  var MESSAGE_ERROR = "Enter your message";
  var REPLY_ERROR = "Enter a reply";
  var EMAIL_TYPE = "email";

  function text(s) {
    return typeof s === "string" ? s.trim() : "";
  }

  function formatReference(n) {
    var digits = String(n);
    while (digits.length < 6) digits = "0" + digits;
    return "ENQ-" + digits;
  }

  function numberOf(reference) {
    var m = /^ENQ-(\d{6})$/.exec(String(reference || ""));
    return m ? Number(m[1]) : 0;
  }

  function nextReference(enquiries) {
    var highest = (enquiries || []).reduce(function (max, e) {
      return Math.max(max, numberOf(e && e.reference));
    }, 0);
    return formatReference(highest + 1);
  }

  function validate(input) {
    input = input || {};
    var errors = {};
    var signedIn = Boolean(input.customerId);

    if (!TYPES.hasOwnProperty(input.type)) {
      errors.type = "Choose the type of enquiry";
    } else if (input.type === "booking") {
      if (!signedIn) errors.type = "Sign in to send an enquiry about a booking";
      else if ((input.bookingIds || []).indexOf(input.bookingId) === -1) errors.bookingId = "Choose one of your bookings";
    }

    if (!signedIn) {
      if (!text(input.name)) errors.name = "Enter your name";
      if (!PHCValidate.email(input.email)) errors.email = "Enter a valid email address";
    }

    if (!text(input.message)) errors.message = MESSAGE_ERROR;

    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  function createEnquiry(input, enquiries, now) {
    var check = validate(input);
    if (!check.ok) return { ok: false, errors: check.errors };
    var reference = nextReference(enquiries);
    var signedIn = Boolean(input.customerId);
    return {
      ok: true,
      errors: {},
      enquiry: {
        id: reference.toLowerCase(),
        reference: reference,
        customerId: signedIn ? input.customerId : null,
        name: signedIn ? null : text(input.name),
        email: signedIn ? null : text(input.email),
        type: input.type,
        bookingId: input.type === "booking" ? input.bookingId : null,
        message: text(input.message),
        status: "open",
        createdAt: new Date(now).toISOString(),
        replies: []
      }
    };
  }

  function statusLabel(enquiry) {
    return enquiry && enquiry.status === "answered" ? "Answered" : "Open";
  }

  // "Airport transfer to Heathrow, Mon 1 Dec 2026, 09:00" (date in the browser's time zone).
  function bookingLabel(booking) {
    if (!booking) return "Booking no longer found";
    var when = new Date(booking.pickupAt).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    return booking.serviceName + " to " + booking.destination + ", " + when;
  }

  function forCustomer(enquiries, customerId) {
    return (enquiries || [])
      .filter(function (e) { return e.customerId === customerId; })
      .sort(function (a, b) { return numberOf(b.reference) - numberOf(a.reference); });
  }

  // ---------- US16 (PHC-14): staff inbox, replies and new emails ----------

  function typeLabel(enquiry) {
    if (!enquiry) return "";
    if (enquiry.type === EMAIL_TYPE) return "Email from PrivateHire Cars";
    return TYPES[enquiry.type] || String(enquiry.type || "");
  }

  function customerName(enquiry, customers) {
    if (!enquiry) return "Unknown";
    if (enquiry.customerId) {
      var found = (customers || []).filter(function (c) { return c.id === enquiry.customerId; })[0];
      return found ? found.name : "Unknown customer";
    }
    return enquiry.name ? enquiry.name + " (guest)" : "Unknown (guest)";
  }

  function byTime(a, b) {
    return new Date(a.createdAt) - new Date(b.createdAt);
  }

  function inbox(enquiries) {
    return (enquiries || []).filter(function (e) { return e && e.status !== "answered"; }).sort(byTime);
  }

  function answered(enquiries) {
    return (enquiries || []).filter(function (e) { return e && e.status === "answered"; }).sort(byTime).reverse();
  }

  function addReply(enquiry, message, now) {
    if (!enquiry) return { ok: false, error: "Enquiry not found" };
    if (!text(message)) return { ok: false, error: REPLY_ERROR };
    var updated = JSON.parse(JSON.stringify(enquiry));
    if (!Array.isArray(updated.replies)) updated.replies = [];
    updated.replies.push({ from: "staff", message: text(message), sentAt: new Date(now).toISOString() });
    updated.status = "answered";
    return { ok: true, enquiry: updated };
  }

  function createEmail(input, enquiries, customerIds, now) {
    input = input || {};
    var errors = {};
    if (!input.customerId || (customerIds || []).indexOf(input.customerId) === -1) errors.customerId = "Choose a customer";
    if (!text(input.message)) errors.message = "Enter the email text";
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    var reference = nextReference(enquiries);
    return {
      ok: true,
      errors: {},
      enquiry: {
        id: reference.toLowerCase(),
        reference: reference,
        customerId: input.customerId,
        name: null,
        email: null,
        type: EMAIL_TYPE,
        bookingId: null,
        message: text(input.message),
        status: "answered",
        createdAt: new Date(now).toISOString(),
        replies: []
      }
    };
  }

  // Another tab changed the shared state (ui.js fires "phc:session-change" for any write).
  // `shownFor` and `now` are "role:id", or "" when nobody is signed in. Returns the type to
  // redraw the form with, or null to leave the page and what was typed alone (PR #18 review).
  function redrawType(shownFor, now, type, isCustomer) {
    if (shownFor === now) return null;
    return type === "booking" && isCustomer ? "booking" : "general";
  }

  return {
    TYPES: TYPES,
    MESSAGE_ERROR: MESSAGE_ERROR,
    REPLY_ERROR: REPLY_ERROR,
    EMAIL_TYPE: EMAIL_TYPE,
    typeLabel: typeLabel,
    customerName: customerName,
    inbox: inbox,
    answered: answered,
    addReply: addReply,
    createEmail: createEmail,
    formatReference: formatReference,
    nextReference: nextReference,
    validate: validate,
    createEnquiry: createEnquiry,
    statusLabel: statusLabel,
    bookingLabel: bookingLabel,
    forCustomer: forCustomer,
    redrawType: redrawType
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCEnquiry;
}
