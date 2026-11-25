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

  // ---------- PHC-21: vehicle availability ----------
  function availableCar(id, size) {
    return { id: id, size: size, status: "available" };
  }

  function fleetBooking(id, size, startHours, durationHours, status) {
    return {
      id: id,
      carSize: size,
      pickupAt: new Date(NOW.getTime() + startHours * HOUR).toISOString(),
      hours: durationHours,
      status: status || "confirmed"
    };
  }

  test("vehicleAvailability: alternative size must fit all passengers", function () {
    var cars = [availableCar("four", 4), availableCar("seven", 7)];
    var bookings = [fleetBooking("busy-seven", 7, 1, 2)];
    var result = PHCRules.vehicleAvailability(
      cars, bookings, 7, new Date(NOW.getTime() + HOUR), 6, 2
    );
    equal(result.available, false);
    equal(result.alternativeSize, null);
  });

  test("vehicleAvailability: suggested time is checked and skips occupied hours", function () {
    var cars = [availableCar("four", 4)];
    var bookings = [fleetBooking("busy-four", 4, 1, 4)];
    var result = PHCRules.vehicleAvailability(
      cars, bookings, 4, new Date(NOW.getTime() + HOUR), 2, 2
    );
    equal(result.available, false);
    equal(result.nextTime, new Date(NOW.getTime() + 5 * HOUR).toISOString());
  });

  test("vehicleAvailability: actual booking duration prevents interval overlap", function () {
    var cars = [availableCar("four", 4)];
    var bookings = [fleetBooking("daily-hire", 4, 3, 8)];
    var result = PHCRules.vehicleAvailability(
      cars, bookings, 4, new Date(NOW.getTime() + 7 * HOUR), 2, 2
    );
    equal(result.available, false);
  });

  test("vehicleAvailability: cancelled bookings do not consume a vehicle", function () {
    var cars = [availableCar("four", 4)];
    var bookings = [fleetBooking("cancelled", 4, 1, 8, "cancelled")];
    var result = PHCRules.vehicleAvailability(
      cars, bookings, 4, new Date(NOW.getTime() + 2 * HOUR), 2, 2
    );
    equal(result.available, true);
    equal(result.count, 1);
  });

  test("vehicleAvailability: sequential overlaps consume only peak concurrent capacity", function () {
    var cars = [availableCar("four-a", 4), availableCar("four-b", 4)];
    var bookings = [
      fleetBooking("early", 4, 0, 2),
      fleetBooking("late", 4, 4, 2)
    ];
    var result = PHCRules.vehicleAvailability(
      cars, bookings, 4, new Date(NOW.getTime() + HOUR), 2, 4
    );
    equal(result.available, true);
    equal(result.count, 1);
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

  // ---------- US05: validateBooking ----------
  // Dates are built in local time from NOW so the tests pass in any time zone.
  function localDate(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function localTime(ms) {
    var d = new Date(ms);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function details(overrides) {
    var at = NOW.getTime() + 48 * HOUR;
    var base = {
      pickup: "1 High St, E1 6AN",
      destination: "Heathrow Terminal 5",
      date: localDate(at),
      time: localTime(at),
      passengers: 2,
      carSize: 4
    };
    Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
    return base;
  }

  test("validateBooking: valid - complete details in 48h pass and return pickupAt", function () {
    var r = PHCRules.validateBooking(details(), NOW);
    equal(r.valid, true);
    equal(Object.keys(r.errors).length, 0);
    equal(new Date(r.pickupAt).getTime(), NOW.getTime() + 48 * HOUR);
  });

  test("validateBooking: invalid - every missing required field gets its own error", function () {
    var r = PHCRules.validateBooking({}, NOW);
    equal(r.valid, false);
    equal(Object.keys(r.errors).sort().join(","), "carSize,date,destination,passengers,pickup,time");
  });

  test("validateBooking: invalid - pick-up in the past shows the future-date message", function () {
    var past = NOW.getTime() - 2 * HOUR;
    var r = PHCRules.validateBooking(details({ date: localDate(past), time: localTime(past) }), NOW);
    equal(r.valid, false);
    equal(r.errors.date, "Date and time must be in the future");
  });

  test("validateBooking: threshold - exactly now is rejected, 1 minute later is accepted", function () {
    var nowParts = details({ date: localDate(NOW.getTime()), time: localTime(NOW.getTime()) });
    equal(PHCRules.validateBooking(nowParts, NOW).errors.date, "Date and time must be in the future");
    var later = NOW.getTime() + 60 * 1000;
    equal(PHCRules.validateBooking(details({ date: localDate(later), time: localTime(later) }), NOW).valid, true);
  });

  test("validateBooking: invalid calendar date (30 February) is rejected", function () {
    var r = PHCRules.validateBooking(details({ date: "2027-02-30", time: "10:00" }), NOW);
    equal(r.errors.date, "Enter a valid date and time");
  });

  test("validateBooking: 5 passengers in a 4-seater suggests a 7-seater", function () {
    var r = PHCRules.validateBooking(details({ passengers: 5, carSize: 4 }), NOW);
    equal(r.valid, false);
    equal(r.suggestedCarSize, 7);
    equal(r.errors.carSize, "A 4-seater takes up to 4 passengers. Choose a 7-seater for 5 passengers.");
  });

  test("validateBooking: threshold - 4 passengers fit a 4-seater, 7 fit a 7-seater, 8 is too many", function () {
    equal(PHCRules.validateBooking(details({ passengers: 4, carSize: 4 }), NOW).valid, true);
    equal(PHCRules.validateBooking(details({ passengers: 7, carSize: 7 }), NOW).valid, true);
    var r = PHCRules.validateBooking(details({ passengers: 8, carSize: 7 }), NOW);
    equal(r.valid, false);
    equal(typeof r.errors.passengers, "string");
  });

  test("validateBooking: passengers must be a whole number of at least 1", function () {
    equal(typeof PHCRules.validateBooking(details({ passengers: 0 }), NOW).errors.passengers, "string");
    equal(typeof PHCRules.validateBooking(details({ passengers: 2.5 }), NOW).errors.passengers, "string");
    equal(typeof PHCRules.validateBooking(details({ passengers: "abc" }), NOW).errors.passengers, "string");
  });

  test("validateBooking: same pick-up and destination is rejected", function () {
    var r = PHCRules.validateBooking(details({ destination: " 1 high st, e1 6an " }), NOW);
    equal(r.errors.destination, "Destination must be different from the pick-up address");
  });

  test("validateBooking: daily hire needs 1 to 12 hours", function () {
    equal(PHCRules.validateBooking(details({ byTime: true, hours: 4 }), NOW).valid, true);
    equal(typeof PHCRules.validateBooking(details({ byTime: true }), NOW).errors.hours, "string");
    equal(typeof PHCRules.validateBooking(details({ byTime: true, hours: 13 }), NOW).errors.hours, "string");
  });

  test("validateBooking: invalid 'now' throws", function () {
    throws(function () { PHCRules.validateBooking(details(), "not a date"); });
  });

  test("suggestCarSize and bookingTag", function () {
    equal(PHCRules.suggestCarSize(3), 4);
    equal(PHCRules.suggestCarSize(6), 7);
    equal(PHCRules.suggestCarSize(9), null);
    equal(PHCRules.bookingTag("online"), "Priority");
    equal(PHCRules.bookingTag("phone"), "Standard");
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
