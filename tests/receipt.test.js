/* Unit tests for js/receipt-rules.js (PHC-24 / US09). Uses PHCTest from tests/index.html. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;

  var OWNER = { role: "customer", id: "c1" };

  function paid(extra) {
    var b = {
      id: "bk12ab", customerId: "c1", serviceId: "airport", serviceName: "Airport transfer", flight: "BA123", hours: null,
      pickup: "1 High St", destination: "Heathrow", pickupAt: "2026-12-05T14:30:00", passengers: 3, carSize: 4,
      baseFare: 45, discount: 6.75, total: 38.25, channel: "online", tag: "Priority", status: "confirmed",
      payment: { method: "card", brand: "Visa", last4: "4242", paidAt: "2026-11-25T10:00:00Z", reference: "PAY-ABC123" }
    };
    for (var k in extra) b[k] = extra[k];
    return b;
  }

  test("receipt: paid booking of the signed-in customer can be viewed", function () {
    equal(PHCReceipt.canView(paid(), OWNER).ok, true);
  });

  test("receipt: missing booking is not found", function () {
    equal(PHCReceipt.canView(null, OWNER).reason, "not-found");
  });

  test("receipt: another customer's booking looks like not found", function () {
    equal(PHCReceipt.canView(paid(), { role: "customer", id: "c2" }).reason, "not-found");
  });

  test("receipt: no session or a staff session asks to sign in as a customer", function () {
    equal(PHCReceipt.canView(paid(), null).reason, "sign-in");
    equal(PHCReceipt.canView(paid(), { role: "staff", id: "s1" }).reason, "sign-in");
  });

  test("receipt: unpaid booking has no receipt", function () {
    equal(PHCReceipt.canView(paid({ status: "unpaid", payment: undefined }), OWNER).reason, "unpaid");
  });

  test("receipt: confirmed booking without a payment record has no receipt", function () {
    equal(PHCReceipt.canView(paid({ payment: undefined }), OWNER).reason, "unpaid");
  });

  test("receipt: cancelled booking has no receipt", function () {
    equal(PHCReceipt.canView(paid({ status: "cancelled" }), OWNER).reason, "cancelled");
  });

  test("receipt: every refusal reason has a customer sentence", function () {
    ["not-found", "sign-in", "cancelled", "unpaid"].forEach(function (r) {
      equal(PHCReceipt.reasonText(r).length > 10, true);
    });
    equal(PHCReceipt.reasonText("nope"), "");
  });

  test("receipt: booking reference is built from the booking id", function () {
    equal(PHCReceipt.referenceOf(paid()), "PHC-BK12AB");
    equal(PHCReceipt.build(paid()).reference, "PHC-BK12AB");
  });

  test("receipt: journey details are all present", function () {
    var r = PHCReceipt.build(paid());
    equal(r.serviceName, "Airport transfer");
    equal(r.pickup, "1 High St");
    equal(r.destination, "Heathrow");
    equal(r.time, "14:30");
    equal(r.date.indexOf("5 December 2026") !== -1, true);
    equal(r.carSize, 4);
    equal(r.passengers, 3);
    equal(r.flight, "BA123");
  });

  test("receipt: online discount line and final total are listed", function () {
    var r = PHCReceipt.build(paid());
    equal(r.lines.length, 2);
    equal(r.lines[0].amount, 45);
    equal(r.lines[1].label, "Online booking discount");
    equal(r.lines[1].amount, -6.75);
    equal(r.total, 38.25);
  });

  test("receipt: no discount line when no discount was applied", function () {
    var r = PHCReceipt.build(paid({ discount: 0, total: 45 }));
    equal(r.lines.length, 1);
    equal(r.total, 45);
  });

  test("receipt: hours hired is kept for daily hire", function () {
    equal(PHCReceipt.build(paid({ hours: 8 })).hours, 8);
    equal(PHCReceipt.build(paid()).hours, null);
  });

  test("receipt: payment method text for card, PayPal and unknown", function () {
    equal(PHCReceipt.build(paid()).paymentMethod, "Visa ending 4242");
    equal(PHCReceipt.build(paid({ payment: { method: "paypal", paidAt: "2026-11-25T10:00:00Z", reference: "P1" } })).paymentMethod, "PayPal");
    equal(PHCReceipt.build(paid({ payment: { method: "card" } })).paymentMethod, "Paid");
  });
})();
