/* Regression tests for shared vehicle assignment (PHC-16 / US17). */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;
  var A = PHCVehicleAssignment;

  function car(id, size, status, make) {
    return { id: id, size: size, status: status || "available", make: make || id };
  }
  function booking(changes) {
    var b = { id: "new", pickup: "1 High Street", destination: "Heathrow Airport", pickupAt: "2026-12-10T10:00:00", carSize: 4, passengers: 3, serviceId: "airport" };
    Object.keys(changes || {}).forEach(function (key) { b[key] = changes[key]; });
    return b;
  }

  test("assignment: skips an unavailable first matching vehicle", function () {
    var chosen = A.findAvailableCar(booking(), [car("first", 4, "busy"), car("second", 4)], []);
    equal(chosen.id, "second");
  });

  test("assignment: skips a vehicle with an overlapping booking", function () {
    var chosen = A.findAvailableCar(booking(), [car("first", 4), car("second", 4)], [
      booking({ id: "existing", carId: "first", pickupAt: "2026-12-10T10:30:00" })
    ]);
    equal(chosen.id, "second");
  });

  test("assignment: consecutive bookings do not overlap", function () {
    var chosen = A.findAvailableCar(booking({ pickupAt: "2026-12-10T11:00:00" }), [car("first", 4)], [
      booking({ id: "existing", carId: "first", pickupAt: "2026-12-10T10:00:00" })
    ]);
    equal(chosen.id, "first");
  });

  test("assignment: daily hire blocks its full recorded duration", function () {
    var chosen = A.findAvailableCar(booking({ pickupAt: "2026-12-10T12:00:00" }), [car("first", 4), car("second", 4)], [
      booking({ id: "daily", carId: "first", serviceId: "daily-hire", hours: 3, pickupAt: "2026-12-10T10:00:00" })
    ]);
    equal(chosen.id, "second");
  });

  test("assignment: reports no suitable vehicle", function () {
    equal(A.findAvailableCar(booking(), [car("only", 4, "busy")], []), null);
  });

  test("amendment: changes assignment from a 4-seater to a 7-seater", function () {
    var original = booking({ id: "amend", pickupAt: "2026-12-05T10:00:00", carId: "four", carModel: "Four", carSize: 4 });
    var result = PHCBookingChanges.amendBooking(original, { date: "2026-12-06", time: "10:00", carSize: 7 }, "2026-12-01T09:00:00", {
      cars: [car("four", 4, "available", "Four"), car("seven", 7, "available", "Seven")], bookings: [original]
    });
    equal(result.ok, true);
    equal(result.booking.carSize, 7);
    equal(result.booking.carId, "seven");
    equal(result.booking.carModel, "Seven");
  });

  test("amendment: rechecks availability at a different date or time", function () {
    var original = booking({ id: "amend", pickupAt: "2026-12-05T10:00:00", carId: "first", carModel: "First" });
    var conflict = booking({ id: "other", carId: "first", pickupAt: "2026-12-06T10:30:00" });
    var result = PHCBookingChanges.amendBooking(original, { date: "2026-12-06", time: "10:00", carSize: 4 }, "2026-12-01T09:00:00", {
      cars: [car("first", 4, "available", "First"), car("second", 4, "available", "Second")], bookings: [original, conflict]
    });
    equal(result.ok, true);
    equal(result.booking.carId, "second");
  });

  test("amendment: leaves the original booking untouched when no car is available", function () {
    var original = booking({ id: "amend", pickupAt: "2026-12-05T10:00:00", carId: "first", carModel: "First" });
    var result = PHCBookingChanges.amendBooking(original, { date: "2026-12-06", time: "10:00", carSize: 4 }, "2026-12-01T09:00:00", {
      cars: [car("first", 4, "busy", "First")], bookings: [original]
    });
    equal(result.ok, false);
    equal(original.carId, "first");
    equal(original.pickupAt, "2026-12-05T10:00:00");
  });
})();
