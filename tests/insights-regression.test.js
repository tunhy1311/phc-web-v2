/* Regression tests for assigned-car model statistics (PHC-16 / US17). */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;

  function paidBooking(changes) {
    var b = { id: "b", customerId: "c1", serviceId: "airport", pickup: "1 High Street", destination: "Heathrow Airport", pickupAt: "2026-12-10T10:00:00", passengers: 3, status: "confirmed", payment: { amount: 10 } };
    Object.keys(changes || {}).forEach(function (key) { b[key] = changes[key]; });
    return b;
  }

  test("insights: ignores legacy bookings without an assigned vehicle", function () {
    var result = PHCInsights.calculateInsights([
      paidBooking({ id: "legacy" }),
      paidBooking({ id: "assigned", carId: "car7", carModel: "Mercedes V-Class" })
    ], [{ id: "legacy-car", make: "Invented model" }], []);
    equal(result.cars.length, 1);
    equal(result.cars[0].name, "Mercedes V-Class");
  });

  test("insights: uses the amended assigned model", function () {
    var before = paidBooking({ carId: "car1", carModel: "Toyota Prius", carSize: 4 });
    var amended = PHCBookingChanges.amendBooking(before, { date: "2026-12-11", time: "10:00", carSize: 7 }, "2026-12-01T09:00:00", {
      cars: [
        { id: "car1", make: "Toyota Prius", size: 4, status: "available" },
        { id: "car7", make: "Mercedes V-Class", size: 7, status: "available" }
      ], bookings: [before]
    }).booking;
    var result = PHCInsights.calculateInsights([amended], [], []);
    equal(result.cars[0].name, "Mercedes V-Class");
  });
})();
