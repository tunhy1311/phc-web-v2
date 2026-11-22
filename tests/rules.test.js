/* Unit tests for js/rules.js and js/validators.js. Uses PHCTest from tests/index.html. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;
  var throws = PHCTest.throws;

  // Fixed "now" so results never depend on the real clock.
  var NOW = new Date("2026-12-01T09:00:00Z");
  var HOUR = 60 * 60 * 1000;

  function bookingInHours(h, status) {
    return {
      id: "b-test",
      pickupAt: new Date(NOW.getTime() + h * HOUR).toISOString(),
      status: status || "confirmed"
    };
  }

  // ---------- canChangeBooking ----------
  test("canChangeBooking: valid - pick-up in 48h can be changed", function () {
    equal(PHCRules.canChangeBooking(bookingInHours(48), NOW), true);
  });

  test("canChangeBooking: invalid - pick-up in 2h cannot be changed", function () {
    equal(PHCRules.canChangeBooking(bookingInHours(2), NOW), false);
  });

  test("canChangeBooking: threshold - exactly 24h can be changed", function () {
    equal(PHCRules.canChangeBooking(bookingInHours(24), NOW), true);
  });

  test("canChangeBooking: threshold - 1 minute under 24h cannot be changed", function () {
    equal(PHCRules.canChangeBooking(bookingInHours(24 - 1 / 60), NOW), false);
  });

  test("canChangeBooking: pick-up in the past cannot be changed", function () {
    equal(PHCRules.canChangeBooking(bookingInHours(-5), NOW), false);
  });

  test("canChangeBooking: cancelled booking cannot be changed", function () {
    equal(PHCRules.canChangeBooking(bookingInHours(72, "cancelled"), NOW), false);
  });

  test("canChangeBooking: invalid date or missing booking returns false", function () {
    equal(PHCRules.canChangeBooking({ pickupAt: "not a date" }, NOW), false);
    equal(PHCRules.canChangeBooking(null, NOW), false);
    equal(PHCRules.canChangeBooking(bookingInHours(48), undefined), false);
  });

  test("canChangeBooking: accepts now as ms timestamp and ISO string", function () {
    equal(PHCRules.canChangeBooking(bookingInHours(30), NOW.getTime()), true);
    equal(PHCRules.canChangeBooking(bookingInHours(30), NOW.toISOString()), true);
  });

  // ---------- applyOnlineDiscount ----------
  test("applyOnlineDiscount: 15% off £100 is £85", function () {
    equal(PHCRules.applyOnlineDiscount(100), 85);
  });

  test("applyOnlineDiscount: rounds to pence (£45 -> £38.25, £12.99 -> £11.04)", function () {
    equal(PHCRules.applyOnlineDiscount(45), 38.25);
    equal(PHCRules.applyOnlineDiscount(12.99), 11.04);
  });

  test("applyOnlineDiscount: £0 stays £0, negative throws", function () {
    equal(PHCRules.applyOnlineDiscount(0), 0);
    throws(function () { PHCRules.applyOnlineDiscount(-1); });
  });

  // ---------- baseFare ----------
  function service(id) {
    return PHC_DATA.services.filter(function (s) { return s.id === id; })[0];
  }

  test("baseFare: fixed-price service returns fromPrice", function () {
    equal(PHCRules.baseFare(service("airport")), 45);
  });

  test("baseFare: daily hire is fromPrice x hours", function () {
    equal(PHCRules.baseFare(service("daily-hire"), { hours: 4 }), 140);
  });

  test("baseFare: daily hire without hours throws", function () {
    throws(function () { PHCRules.baseFare(service("daily-hire")); });
  });

  // ---------- data contract ----------
  test("PHC_DATA.services: exactly 6, correct flags", function () {
    equal(PHC_DATA.services.length, 6);
    var flight = PHC_DATA.services.filter(function (s) { return s.needsFlight; }).map(function (s) { return s.name; }).join("|");
    var byTime = PHC_DATA.services.filter(function (s) { return s.byTime; }).map(function (s) { return s.name; }).join("|");
    equal(flight, "Airport transfer|Meet & greet at airport");
    equal(byTime, "Driver & car daily hire");
  });

  // ---------- validators ----------
  test("PHCValidate.email", function () {
    equal(PHCValidate.email("sarah@example.com"), true);
    equal(PHCValidate.email("sarah@example"), false);
    equal(PHCValidate.email("not an email"), false);
    equal(PHCValidate.email(""), false);
  });

  test("PHCValidate.phone (UK)", function () {
    equal(PHCValidate.phone("07123 456789"), true);
    equal(PHCValidate.phone("+44 7123 456789"), true);
    equal(PHCValidate.phone("0712345678"), false);   // 10 digits
    equal(PHCValidate.phone("+44 07123 456789"), false);
    equal(PHCValidate.phone("abc"), false);
  });

  test("PHCValidate.postcode (UK)", function () {
    equal(PHCValidate.postcode("E1 6AN"), true);
    equal(PHCValidate.postcode("sw1a1aa"), true);
    equal(PHCValidate.postcode("12345"), false);
  });

  test("PHCValidate.luhn", function () {
    equal(PHCValidate.luhn("4242 4242 4242 4242"), true);
    equal(PHCValidate.luhn("4242424242424241"), false);
    equal(PHCValidate.luhn("1234"), false);
  });
})();
