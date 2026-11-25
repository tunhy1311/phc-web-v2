/* Unit tests for js/enquiry-rules.js (PHC-18 / US03). Uses PHCTest from tests/index.html. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;

  var NOW = Date.UTC(2026, 10, 26, 10, 0, 0);

  function input(extra) {
    var i = { type: "general", message: "Do you have child seats?", customerId: "c1", bookingId: "", bookingIds: ["b1", "b2"] };
    for (var k in extra) i[k] = extra[k];
    return i;
  }

  test("US03 enquiry types are General and About a booking", function () {
    equal(PHCEnquiry.TYPES.general, "General");
    equal(PHCEnquiry.TYPES.booking, "About a booking");
    equal(Object.keys(PHCEnquiry.TYPES).length, 2);
  });

  test("US03 reference is ENQ- followed by 6 digits", function () {
    equal(PHCEnquiry.formatReference(123), "ENQ-000123");
    equal(/^ENQ-\d{6}$/.test(PHCEnquiry.nextReference([])), true);
    equal(PHCEnquiry.nextReference([]), "ENQ-000001");
  });

  test("US03 next reference follows the highest existing one", function () {
    equal(PHCEnquiry.nextReference([{ reference: "ENQ-000004" }, { reference: "ENQ-000002" }]), "ENQ-000005");
    equal(PHCEnquiry.nextReference([{ reference: "bad" }]), "ENQ-000001");
  });

  test("US03 empty message shows 'Enter your message' and nothing is created", function () {
    var r = PHCEnquiry.createEnquiry(input({ message: "   " }), [], NOW);
    equal(r.ok, false);
    equal(r.errors.message, "Enter your message");
    equal(r.enquiry, undefined);
  });

  test("US03 valid general enquiry is saved as open with no booking", function () {
    var r = PHCEnquiry.createEnquiry(input({ message: "  Hello  " }), [{ reference: "ENQ-000122" }], NOW);
    equal(r.ok, true);
    equal(r.enquiry.reference, "ENQ-000123");
    equal(r.enquiry.id, "enq-000123");
    equal(r.enquiry.status, "open");
    equal(r.enquiry.bookingId, null);
    equal(r.enquiry.message, "Hello");
    equal(r.enquiry.customerId, "c1");
    equal(r.enquiry.createdAt, "2026-11-26T10:00:00.000Z");
    equal(r.enquiry.replies.length, 0);
  });

  test("US03 about a booking needs one of the customer's own bookings", function () {
    equal(PHCEnquiry.validate(input({ type: "booking", bookingId: "" })).errors.bookingId, "Choose one of your bookings");
    equal(PHCEnquiry.validate(input({ type: "booking", bookingId: "someone-elses" })).errors.bookingId, "Choose one of your bookings");
    var r = PHCEnquiry.createEnquiry(input({ type: "booking", bookingId: "b2" }), [], NOW);
    equal(r.ok, true);
    equal(r.enquiry.bookingId, "b2");
  });

  test("US03 about a booking is refused when nobody is signed in", function () {
    var v = PHCEnquiry.validate(input({ type: "booking", customerId: null, bookingId: "b1", name: "Ann", email: "ann@example.com" }));
    equal(v.ok, false);
    equal(v.errors.type, "Sign in to send an enquiry about a booking");
  });

  test("US03 guest general enquiry needs a name and a valid email", function () {
    var v = PHCEnquiry.validate(input({ customerId: null, name: "", email: "not-an-email" }));
    equal(v.errors.name, "Enter your name");
    equal(v.errors.email, "Enter a valid email address");
    var r = PHCEnquiry.createEnquiry(input({ customerId: null, name: " Ann ", email: "ann@example.com" }), [], NOW);
    equal(r.ok, true);
    equal(r.enquiry.customerId, null);
    equal(r.enquiry.name, "Ann");
    equal(r.enquiry.email, "ann@example.com");
  });

  test("US03 unknown type is refused", function () {
    equal(PHCEnquiry.validate(input({ type: "complaint" })).errors.type, "Choose the type of enquiry");
  });

  test("US03 status label is Open until staff answer", function () {
    equal(PHCEnquiry.statusLabel({ status: "open" }), "Open");
    equal(PHCEnquiry.statusLabel({ status: "answered" }), "Answered");
  });

  test("US03 My enquiries lists only the customer's enquiries, newest first", function () {
    var list = [
      { reference: "ENQ-000001", customerId: "c1" },
      { reference: "ENQ-000002", customerId: "c2" },
      { reference: "ENQ-000003", customerId: "c1" }
    ];
    var mine = PHCEnquiry.forCustomer(list, "c1");
    equal(mine.length, 2);
    equal(mine[0].reference, "ENQ-000003");
    equal(mine[1].reference, "ENQ-000001");
  });

  test("US03 booking label names the service and destination", function () {
    var label = PHCEnquiry.bookingLabel({ serviceName: "Airport transfer", destination: "Heathrow", pickupAt: "2026-12-01T09:00:00" });
    equal(label.indexOf("Airport transfer to Heathrow, "), 0);
    equal(PHCEnquiry.bookingLabel(null), "Booking no longer found");
  });
})();
