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
 * input = {type, message, customerId|null, bookingId|null, bookingIds: [the customer's booking ids],
 *          name, email}   name and email are only needed when nobody is signed in (General enquiry).
 * The saved record is documented in js/store.js (state key "enquiries"); US16 (PHC-14) reads it.
 */
var PHCEnquiry = (function () {
  "use strict";

  var TYPES = { general: "General", booking: "About a booking" };
  var MESSAGE_ERROR = "Enter your message";

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

  return {
    TYPES: TYPES,
    MESSAGE_ERROR: MESSAGE_ERROR,
    formatReference: formatReference,
    nextReference: nextReference,
    validate: validate,
    createEnquiry: createEnquiry,
    statusLabel: statusLabel,
    bookingLabel: bookingLabel,
    forCustomer: forCustomer
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCEnquiry;
}
