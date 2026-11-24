/* Unit tests for js/booking-changes.js (PHC-25 / US10). Uses PHCTest from tests/index.html. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;
  var throws = PHCTest.throws;

  // Local-time "now" so the tests give the same result in every time zone.
  var NOW = new Date(2026, 11, 1, 9, 0, 0);
  var HOUR = 60 * 60 * 1000;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parts(date) {
    return {
      date: date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()),
      time: pad(date.getHours()) + ":" + pad(date.getMinutes())
    };
  }
  function pickupIn(hours) {
    var p = parts(new Date(NOW.getTime() + hours * HOUR));
    return p.date + "T" + p.time + ":00";
  }
  function booking(hours, extra) {
    var b = {
      id: "b-us10", customerId: "c1", serviceId: "airport", serviceName: "Airport transfer", flight: "BA123", hours: null,
      pickup: "1 High St", destination: "Heathrow", pickupAt: pickupIn(hours), passengers: 3, carSize: 4,
      baseFare: 45, discount: 6.75, total: 38.25, channel: "online", tag: "Priority", status: "confirmed"
    };
    for (var k in extra) b[k] = extra[k];
    return b;
  }
  function changesFor(hours, carSize) {
    var p = parts(new Date(NOW.getTime() + hours * HOUR));
    return { date: p.date, time: p.time, carSize: carSize };
  }

  // ---------- checkChange ----------
  test("checkChange: valid - pick-up in 48h is allowed", function () {
    var c = PHCBookingChanges.checkChange(booking(48), NOW);
    equal(c.allowed, true);
    equal(c.reason, "");
  });

  test("checkChange: threshold - exactly 24h is allowed", function () {
    equal(PHCBookingChanges.checkChange(booking(24), NOW).allowed, true);
  });

  test("checkChange: threshold - 23h 59m is refused with the 24-hour rule", function () {
    var c = PHCBookingChanges.checkChange(booking(24 - 1 / 60), NOW);
    equal(c.allowed, false);
    equal(c.reason, PHCBookingChanges.RULE_MESSAGE);
  });

  test("checkChange: invalid - pick-up in 2h is refused with the 24-hour rule", function () {
    equal(PHCBookingChanges.checkChange(booking(2), NOW).reason, PHCBookingChanges.RULE_MESSAGE);
  });

  test("checkChange: a journey in the past is refused with its own message", function () {
    var c = PHCBookingChanges.checkChange(booking(-3), NOW);
    equal(c.allowed, false);
    equal(c.reason.indexOf("already started or finished") !== -1, true);
  });

  test("checkChange: a cancelled booking is refused", function () {
    var c = PHCBookingChanges.checkChange(booking(72, { status: "cancelled" }), NOW);
    equal(c.allowed, false);
    equal(c.reason, "This booking is already cancelled.");
  });

  test("checkChange: missing booking or invalid pick-up is refused", function () {
    equal(PHCBookingChanges.checkChange(null, NOW).allowed, false);
    equal(PHCBookingChanges.checkChange(booking(48, { pickupAt: "not a date" }), NOW).allowed, false);
  });

  // ---------- cancelBooking ----------
  test("cancelBooking: status becomes cancelled and cancelledAt is set", function () {
    var original = booking(48);
    var r = PHCBookingChanges.cancelBooking(original, NOW);
    equal(r.ok, true);
    equal(r.booking.status, "cancelled");
    equal(r.booking.cancelledAt, NOW.toISOString());
  });

  test("cancelBooking: the original booking object is not changed", function () {
    var original = booking(48);
    PHCBookingChanges.cancelBooking(original, NOW);
    equal(original.status, "confirmed");
  });

  test("cancelBooking: refused inside 24h and when already cancelled", function () {
    var inside = PHCBookingChanges.cancelBooking(booking(5), NOW);
    equal(inside.ok, false);
    equal(inside.error, PHCBookingChanges.RULE_MESSAGE);
    equal(PHCBookingChanges.cancelBooking(booking(48, { status: "cancelled" }), NOW).ok, false);
  });

  test("cancelBooking: an invalid 'now' is refused and nothing is cancelled", function () {
    equal(PHCBookingChanges.cancelBooking(booking(48), "nope").ok, false);
  });

  // ---------- priceFor ----------
  test("priceFor: online booking gets 15% off (45 -> 38.25)", function () {
    var p = PHCBookingChanges.priceFor(booking(48), PHC_DATA.services[2]);
    equal(p.base, 45);
    equal(p.total, 38.25);
    equal(p.discount, 6.75);
  });

  test("priceFor: phone booking pays the base fare", function () {
    var p = PHCBookingChanges.priceFor(booking(48, { channel: "phone" }), PHC_DATA.services[2]);
    equal(p.total, 45);
    equal(p.discount, 0);
  });

  test("priceFor: hourly service uses the hours of the booking (35 x 3 = 105 -> 89.25)", function () {
    var daily = PHC_DATA.services[5];
    var p = PHCBookingChanges.priceFor(booking(48, { serviceId: "daily-hire", hours: 3 }), daily);
    equal(p.base, 105);
    equal(p.total, 89.25);
  });

  // ---------- amendBooking ----------
  test("amendBooking: new time and car size are saved with the price recalculated", function () {
    var r = PHCBookingChanges.amendBooking(booking(48), changesFor(72, 7), NOW);
    equal(r.ok, true);
    equal(r.booking.pickupAt, pickupIn(72));
    equal(r.booking.carSize, 7);
    equal(r.booking.total, 38.25);
    equal(r.booking.amendedAt, NOW.toISOString());
    equal(r.previousTotal, 38.25);
  });

  test("amendBooking: the recalculated price includes the 15% discount", function () {
    var r = PHCBookingChanges.amendBooking(booking(48, { baseFare: 99, discount: 0, total: 99 }), changesFor(72, 4), NOW);
    equal(r.ok, true);
    equal(r.price.base, 45);
    equal(r.price.discount, 6.75);
    equal(r.booking.total, 38.25);
    equal(r.previousTotal, 99);
  });

  test("amendBooking: the original booking object is not changed", function () {
    var original = booking(48);
    PHCBookingChanges.amendBooking(original, changesFor(72, 7), NOW);
    equal(original.carSize, 4);
    equal(original.pickupAt, pickupIn(48));
  });

  test("amendBooking: refused inside 24h with the 24-hour rule", function () {
    var r = PHCBookingChanges.amendBooking(booking(10), changesFor(72, 4), NOW);
    equal(r.ok, false);
    equal(r.errors.form, PHCBookingChanges.RULE_MESSAGE);
  });

  test("amendBooking: a pick-up time in the past is rejected", function () {
    var r = PHCBookingChanges.amendBooking(booking(48), changesFor(-2, 4), NOW);
    equal(r.ok, false);
    equal(r.errors.date, PHCRules.FUTURE_MESSAGE);
  });

  test("amendBooking: a 4-seater is rejected for 5 passengers", function () {
    var r = PHCBookingChanges.amendBooking(booking(48, { passengers: 5, carSize: 7 }), changesFor(72, 4), NOW);
    equal(r.ok, false);
    equal(typeof r.errors.carSize, "string");
  });

  test("amendBooking: missing date, time or car size are reported by field", function () {
    var r = PHCBookingChanges.amendBooking(booking(48), { date: "", time: "", carSize: "" }, NOW);
    equal(r.ok, false);
    equal(typeof r.errors.date, "string");
    equal(typeof r.errors.time, "string");
    equal(typeof r.errors.carSize, "string");
  });

  test("amendBooking: no change is rejected", function () {
    var b = booking(48);
    var p = parts(new Date(NOW.getTime() + 48 * HOUR));
    var r = PHCBookingChanges.amendBooking(b, { date: p.date, time: p.time, carSize: 4 }, NOW);
    equal(r.ok, false);
    equal(r.errors.form.indexOf("Nothing has changed") === 0, true);
  });

  test("amendBooking: an unknown service cannot be amended", function () {
    var r = PHCBookingChanges.amendBooking(booking(48, { serviceId: "nope" }), changesFor(72, 4), NOW);
    equal(r.ok, false);
  });
})();
