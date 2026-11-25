(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;
  var P = PHCPayment;

  var NOW = new Date(2026, 11, 1, 9, 0, 0);

  function card(changes) {
    var c = { name: "Sarah Jones", number: "4242 4242 4242 4242", expiry: "12/27", cvv: "123" };
    Object.keys(changes || {}).forEach(function (k) { c[k] = changes[k]; });
    return c;
  }

  function booking(changes) {
    var b = { id: "b1", customerId: "c1", status: "unpaid", total: 38.25 };
    Object.keys(changes || {}).forEach(function (k) { b[k] = changes[k]; });
    return b;
  }

  test("cardBrand: Visa, Mastercard and Amex test cards are recognised", function () {
    equal(P.cardBrand("4242 4242 4242 4242"), "Visa");
    equal(P.cardBrand("5555-5555-5555-4444"), "Mastercard");
    equal(P.cardBrand("2221000000000009"), "Mastercard");
    equal(P.cardBrand("3782 822463 10005"), "Amex");
  });

  test("cardBrand: an unknown or short number has no brand", function () {
    equal(P.cardBrand("6011111111111117"), "");
    equal(P.cardBrand("4242"), "");
    equal(P.cardBrand(""), "");
  });

  test("validateCard: a valid Visa card passes and keeps only the last 4 digits", function () {
    var r = P.validateCard(card(), NOW);
    equal(r.valid, true);
    equal(r.brand, "Visa");
    equal(r.last4, "4242");
  });

  test("validateCard: a number that fails the Luhn check is not valid", function () {
    equal(P.validateCard(card({ number: "4242 4242 4242 4241" }), NOW).errors.number, "Card number is not valid");
  });

  test("validateCard: an unsupported card brand is not valid", function () {
    equal(P.validateCard(card({ number: "6011111111111117" }), NOW).errors.number, "Card number is not valid");
  });

  test("validateCard: an empty card number is not valid", function () {
    equal(P.validateCard(card({ number: "" }), NOW).errors.number, "Card number is not valid");
  });

  test("validateCard: expiry in a past month is expired", function () {
    equal(P.validateCard(card({ expiry: "11/26" }), NOW).errors.expiry, "Card has expired");
  });

  test("validateCard: threshold - expiry in the current month is still valid", function () {
    equal(P.validateCard(card({ expiry: "12/26" }), NOW).errors.expiry, undefined);
  });

  test("validateCard: expiry that is not MM/YY asks for the format", function () {
    equal(P.validateCard(card({ expiry: "13/27" }), NOW).errors.expiry, "Enter the expiry date as MM/YY");
    equal(P.validateCard(card({ expiry: "" }), NOW).errors.expiry, "Enter the expiry date as MM/YY");
  });

  test("validateCard: Visa needs a 3-digit security code", function () {
    equal(P.validateCard(card({ cvv: "1234" }), NOW).errors.cvv, "Security code must be 3 digits (4 for Amex)");
    equal(P.validateCard(card({ cvv: "12" }), NOW).errors.cvv, "Security code must be 3 digits (4 for Amex)");
  });

  test("validateCard: Amex needs a 4-digit security code", function () {
    var amex = card({ number: "3782 822463 10005" });
    amex.cvv = "1234";
    equal(P.validateCard(amex, NOW).valid, true);
    amex.cvv = "123";
    equal(P.validateCard(amex, NOW).errors.cvv, "Security code must be 3 digits (4 for Amex)");
  });

  test("validateCard: the name on the card is required", function () {
    equal(P.validateCard(card({ name: "  " }), NOW).errors.name, "Enter the name on the card");
  });

  test("authorise: the agreed decline card is declined by the bank", function () {
    var r = P.authorise("4000 0000 0000 0002");
    equal(r.ok, false);
    equal(r.error, "Card declined by bank");
  });

  test("authorise: every agreed approve card is approved", function () {
    P.TEST_CARDS.approve.forEach(function (n) { equal(P.authorise(n).ok, true); });
  });

  test("canPay: the owner can pay an unpaid booking", function () {
    equal(P.canPay(booking(), { role: "customer", id: "c1" }).ok, true);
  });

  test("canPay: staff can take payment for any unpaid booking", function () {
    equal(P.canPay(booking(), { role: "staff", id: "s1" }).ok, true);
  });

  test("canPay: another customer cannot see the booking", function () {
    equal(P.canPay(booking(), { role: "customer", id: "c2" }).reason, "not-found");
  });

  test("canPay: no session asks to sign in", function () {
    equal(P.canPay(booking(), null).reason, "sign-in");
  });

  test("canPay: confirmed and cancelled bookings cannot be paid again", function () {
    equal(P.canPay(booking({ status: "confirmed" }), { role: "customer", id: "c1" }).reason, "paid");
    equal(P.canPay(booking({ status: "cancelled" }), { role: "customer", id: "c1" }).reason, "cancelled");
  });

  test("markPaid: booking becomes confirmed and the original is not changed", function () {
    var before = booking();
    var after = P.markPaid(before, { method: "card", brand: "Visa", last4: "4242", paidAt: "2026-12-01T09:00:00Z", reference: "PAY-1" });
    equal(after.status, "confirmed");
    equal(after.payment.last4, "4242");
    equal(before.status, "unpaid");
  });

  test("markPaid: only method, brand, last 4 digits, time and reference are stored", function () {
    var after = P.markPaid(booking(), { method: "card", brand: "Visa", last4: "4242", number: "4242424242424242", cvv: "123", paidAt: "x", reference: "r" });
    equal(Object.keys(after.payment).sort().join(","), "brand,last4,method,paidAt,reference");
  });
})();
