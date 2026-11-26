/* PHC-22 US07 acceptance-criteria unit tests (pure rules; no browser state needed). */
(function () {
  "use strict";
  var N = PHCNotifications;
  var sample = { id: "b-1", customerId: "c1", status: "confirmed", carSize: 4, notification: { method: "both", phone: "07123456789" } };
  var car = { id: "car1", driverId: "d1", registration: "LB19 XKT", colour: "Black", make: "Toyota Prius", size: 4, status: "available" };
  var driver = { id: "d1", name: "James Carter" };
  var customer = { email: "sarah@example.com" };
  function deep(x) { return JSON.parse(JSON.stringify(x)); }
  PHCTest.test("US07: Email selection is valid without a phone", function () {
    PHCTest.equal(N.validatePreference("email", "").valid, true);
  });
  PHCTest.test("US07: Text selection accepts 11-digit UK phone", function () {
    PHCTest.equal(N.validatePreference("text", "07123 456789").valid, true);
  });
  PHCTest.test("US07: Both selection accepts 11-digit UK phone", function () {
    PHCTest.equal(N.validatePreference("both", "07123456789").valid, true);
  });
  PHCTest.test("US07: invalid Text phone shows the exact acceptance message", function () {
    PHCTest.equal(N.validatePreference("text", "07123").errors.phone, "Enter an 11-digit UK phone number");
  });
  PHCTest.test("US07: invalid Both phone is blocked", function () {
    PHCTest.equal(N.validatePreference("both", "07123").valid, false);
  });
  PHCTest.test("US07: Email only never requires or saves a phone", function () {
    var r = N.savePreference(sample, "email", "", "2026-11-25T12:00:00Z");
    PHCTest.equal(r.ok, true);
    PHCTest.equal(r.booking.notification.phone, "");
    PHCTest.equal(r.booking.notification.method, "email");
  });
  PHCTest.test("US07: only the booking owner may edit preference", function () {
    PHCTest.equal(N.belongsToCustomer(sample, { role: "customer", id: "c2" }), false);
    PHCTest.equal(N.belongsToCustomer(sample, { role: "customer", id: "c1" }), true);
  });
  PHCTest.test("US07: unpaid bookings may choose a notification preference before payment", function () {
    var b = deep(sample); b.status = "unpaid";
    PHCTest.equal(N.belongsToCustomer(b, { role: "customer", id: "c1" }), true);
    var result = N.savePreference(b, "both", "07123456789");
    PHCTest.equal(result.ok, true);
    PHCTest.equal(result.booking.status, "unpaid");
  });
  PHCTest.test("US07: unpaid bookings cannot trigger driver approaching alerts", function () {
    var b = deep(sample); b.status = "unpaid";
    PHCTest.equal(N.createApproachPreview(b, car, driver, customer, 12).ok, false);
  });
  PHCTest.test("US07: cancelled booking cannot configure notifications", function () {
    var b = deep(sample); b.status = "cancelled";
    PHCTest.equal(N.savePreference(b, "email", "").ok, false);
  });
  PHCTest.test("US07: unknown delivery method cannot be saved", function () {
    PHCTest.equal(N.validatePreference("pigeon", "").valid, false);
  });
  PHCTest.test("US07: assignment rejects car too small for booking", function () {
    var b = deep(sample); b.carSize = 7;
    PHCTest.equal(N.canAssignCar(b, car, [driver]), false);
  });
  PHCTest.test("US07: approach preview contains registration colour and make", function () {
    var r = N.createApproachPreview(sample, car, driver, customer, 12, "2026-11-25T12:00:00Z");
    PHCTest.equal(r.ok, true);
    PHCTest.equal(r.textPreview.indexOf("LB19 XKT") >= 0, true);
    PHCTest.equal(r.textPreview.indexOf("Black") >= 0, true);
    PHCTest.equal(r.textPreview.indexOf("Toyota Prius") >= 0, true);
  });
  PHCTest.test("US07: Email only triggers no Text preview", function () {
    var b = deep(sample); b.notification.method = "email"; b.notification.phone = "";
    var r = N.createApproachPreview(b, car, driver, customer, 10);
    PHCTest.equal(r.ok, true);
    PHCTest.equal(r.textPreview, null);
    PHCTest.equal(!!r.emailPreview, true);
  });
  PHCTest.test("US07: Text only triggers no Email preview", function () {
    var b = deep(sample); b.notification.method = "text";
    var r = N.createApproachPreview(b, car, driver, customer, 15);
    PHCTest.equal(r.ok, true);
    PHCTest.equal(r.emailPreview, null);
    PHCTest.equal(!!r.textPreview, true);
  });
  PHCTest.test("US07: alert must be 10–15 minutes away", function () {
    PHCTest.equal(N.createApproachPreview(sample, car, driver, customer, 9).ok, false);
    PHCTest.equal(N.createApproachPreview(sample, car, driver, customer, 16).ok, false);
  });
  PHCTest.test("US07: cannot trigger an alert before preferences are chosen", function () {
    var b = deep(sample); delete b.notification;
    PHCTest.equal(N.createApproachPreview(b, car, driver, customer, 12).ok, false);
  });
  PHCTest.test("US07: applying a preference does not mutate the input booking", function () {
    var b = deep(sample); delete b.notification;
    N.savePreference(b, "both", "07123 456789");
    PHCTest.equal(b.notification, undefined);
  });

  PHCTest.test("US07: available car can be assigned", function () {
    PHCTest.equal(N.canAssignCar(sample, car, [driver]), true);
  });

  PHCTest.test("US07: busy car cannot be assigned", function () {
    var busyCar = deep(car);
    busyCar.status = "busy";
    PHCTest.equal(N.canAssignCar(sample, busyCar, [driver]), false);
  });

  PHCTest.test("US07: unavailable car cannot be assigned", function () {
    var unavailableCar = deep(car);
    unavailableCar.status = "unavailable";
    PHCTest.equal(N.canAssignCar(sample, unavailableCar, [driver]), false);
  });

  PHCTest.test("US07: car without status cannot be assigned", function () {
    var noStatusCar = deep(car);
    delete noStatusCar.status;
    PHCTest.equal(N.canAssignCar(sample, noStatusCar, [driver]), false);
  });

  PHCTest.test("US07: busy car cannot trigger approaching alert", function () {
    var busyCar = deep(car);
    busyCar.status = "busy";
    PHCTest.equal(
      N.createApproachPreview(sample, busyCar, driver, customer, 12).ok,
      false
    );
  });

  PHCTest.test("US07: unavailable car cannot trigger approaching alert", function () {
    var unavailableCar = deep(car);
    unavailableCar.status = "unavailable";
    PHCTest.equal(
      N.createApproachPreview(sample, unavailableCar, driver, customer, 12).ok,
      false
    );
  });

  // PHC-22: Staff access regression tests

  PHCTest.test("US07: guest cannot access staff alerts", function () {
    var previousSession = PHCStore.session();

    try {
      PHCStore.setSession(null);
      PHCTest.equal(PHCStaffAuth.current(), null);
    } finally {
      PHCStore.setSession(previousSession);
    }
  });

  PHCTest.test("US07: customer cannot access staff alerts", function () {
    var previousSession = PHCStore.session();

    try {
      PHCStore.setSession({
        role: "customer",
        id: "c1"
      });

      PHCTest.equal(PHCStaffAuth.current(), null);
    } finally {
      PHCStore.setSession(previousSession);
    }
  });

  PHCTest.test("US07: valid staff session can access staff alerts", function () {
    var previousSession = PHCStore.session();

    try {
      var staff = PHC_DATA.staff[0];

      PHCStore.setSession({
        role: "staff",
        id: staff.id
      });

      PHCTest.equal(PHCStaffAuth.current() !== null, true);
    } finally {
      PHCStore.setSession(previousSession);
    }
  });
})();