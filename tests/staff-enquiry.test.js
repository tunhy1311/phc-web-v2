/* Unit tests for the staff functions of js/enquiry-rules.js (PHC-14 / US16). Uses PHCTest from tests/index.html. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;

  var NOW = Date.UTC(2026, 10, 26, 10, 0, 0);
  var CUSTOMERS = [{ id: "c1", name: "Sarah Jones" }, { id: "c2", name: "Tom Hall" }];

  function enq(extra) {
    var e = {
      id: "enq-000001", reference: "ENQ-000001", customerId: "c1", name: null, email: null, type: "general",
      bookingId: null, message: "Do you have child seats?", status: "open", createdAt: "2026-11-25T09:00:00.000Z", replies: []
    };
    for (var k in extra) e[k] = extra[k];
    return e;
  }

  test("US16 inbox lists open enquiries only, oldest first", function () {
    var list = [
      enq({ reference: "ENQ-000003", createdAt: "2026-11-25T11:00:00.000Z" }),
      enq({ reference: "ENQ-000002", status: "answered" }),
      enq({ reference: "ENQ-000001", createdAt: "2026-11-25T09:00:00.000Z" })
    ];
    var inbox = PHCEnquiry.inbox(list);
    equal(inbox.length, 2);
    equal(inbox[0].reference, "ENQ-000001");
    equal(inbox[1].reference, "ENQ-000003");
  });

  test("US16 answered enquiries are listed newest first", function () {
    var list = [
      enq({ reference: "ENQ-000001", status: "answered", createdAt: "2026-11-24T09:00:00.000Z" }),
      enq({ reference: "ENQ-000002", status: "answered", createdAt: "2026-11-25T09:00:00.000Z" }),
      enq({ reference: "ENQ-000003" })
    ];
    var done = PHCEnquiry.answered(list);
    equal(done.length, 2);
    equal(done[0].reference, "ENQ-000002");
  });

  test("US16 inbox shows the customer name, or the guest name", function () {
    equal(PHCEnquiry.customerName(enq(), CUSTOMERS), "Sarah Jones");
    equal(PHCEnquiry.customerName(enq({ customerId: null, name: "Alex Guest" }), CUSTOMERS), "Alex Guest (guest)");
    equal(PHCEnquiry.customerName(enq({ customerId: "gone" }), CUSTOMERS), "Unknown customer");
  });

  test("US16 type label covers general, booking and staff emails", function () {
    equal(PHCEnquiry.typeLabel(enq()), "General");
    equal(PHCEnquiry.typeLabel(enq({ type: "booking" })), "About a booking");
    equal(PHCEnquiry.typeLabel(enq({ type: "email" })), "Email from PrivateHire Cars");
  });

  test("US16 a reply is saved and the status becomes Answered", function () {
    var r = PHCEnquiry.addReply(enq(), "  Yes, we can add one.  ", NOW);
    equal(r.ok, true);
    equal(r.enquiry.status, "answered");
    equal(PHCEnquiry.statusLabel(r.enquiry), "Answered");
    equal(r.enquiry.replies.length, 1);
    equal(r.enquiry.replies[0].from, "staff");
    equal(r.enquiry.replies[0].message, "Yes, we can add one.");
    equal(r.enquiry.replies[0].sentAt, "2026-11-26T10:00:00.000Z");
  });

  test("US16 an empty reply shows 'Enter a reply' and nothing is saved", function () {
    var original = enq();
    ["", "   ", null, undefined].forEach(function (blank) {
      var r = PHCEnquiry.addReply(original, blank, NOW);
      equal(r.ok, false);
      equal(r.error, "Enter a reply");
      equal(r.enquiry, undefined);
    });
    equal(original.status, "open");
    equal(original.replies.length, 0);
  });

  test("US16 a reply does not change the original record and keeps earlier replies", function () {
    var original = enq({ replies: [{ from: "staff", message: "First", sentAt: "2026-11-25T10:00:00.000Z" }] });
    var r = PHCEnquiry.addReply(original, "Second", NOW);
    equal(original.replies.length, 1);
    equal(r.enquiry.replies.length, 2);
    equal(r.enquiry.replies[1].message, "Second");
  });

  test("US16 a reply to a missing enquiry fails", function () {
    equal(PHCEnquiry.addReply(null, "Hello", NOW).ok, false);
  });

  test("US16 a new email needs a customer and some text", function () {
    var noCustomer = PHCEnquiry.createEmail({ customerId: "", message: "Hello" }, [], ["c1"], NOW);
    equal(noCustomer.ok, false);
    equal(noCustomer.errors.customerId, "Choose a customer");
    var unknown = PHCEnquiry.createEmail({ customerId: "zz", message: "Hello" }, [], ["c1"], NOW);
    equal(unknown.errors.customerId, "Choose a customer");
    var noText = PHCEnquiry.createEmail({ customerId: "c1", message: "  " }, [], ["c1"], NOW);
    equal(noText.ok, false);
    equal(noText.errors.message, "Enter the email text");
  });

  test("US16 a new email is saved for that customer and appears in their history", function () {
    var existing = [enq({ reference: "ENQ-000004" })];
    var r = PHCEnquiry.createEmail({ customerId: "c2", message: " Your car is confirmed. " }, existing, ["c1", "c2"], NOW);
    equal(r.ok, true);
    equal(r.enquiry.reference, "ENQ-000005");
    equal(r.enquiry.type, "email");
    equal(r.enquiry.status, "answered");
    equal(r.enquiry.message, "Your car is confirmed.");
    var history = PHCEnquiry.forCustomer(existing.concat([r.enquiry]), "c2");
    equal(history.length, 1);
    equal(history[0].reference, "ENQ-000005");
    equal(PHCEnquiry.forCustomer(existing.concat([r.enquiry]), "c1").length, 1);
  });

  test("US16 the customer sees the staff reply on the saved record", function () {
    var replied = PHCEnquiry.addReply(enq(), "We can help.", NOW).enquiry;
    var mine = PHCEnquiry.forCustomer([replied], "c1")[0];
    equal(mine.replies[0].message, "We can help.");
    equal(PHCEnquiry.statusLabel(mine), "Answered");
  });
})();
