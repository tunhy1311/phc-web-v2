(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;
  var S = PHCStaffBooking;

  var NOW = new Date(2026, 11, 1, 9, 0, 0);
  var CUSTOMERS = [
    { id: "c1", name: "Sarah Jones", email: "sarah@example.com", phone: "07123 456789" }
  ];

  function service(id) {
    return PHC_DATA.services.filter(function (s) { return s.id === id; })[0];
  }

  function details(changes) {
    var d = {
      channel: "phone", pickup: "1 High St", destination: "Heathrow T5",
      date: "2026-12-05", time: "10:30", passengers: 2, carSize: 4, hours: "", flight: ""
    };
    Object.keys(changes || {}).forEach(function (k) { d[k] = changes[k]; });
    return d;
  }

  function withFreshStore(fn) {
    var snapshot = PHCStore.all();
    PHCStore.reset();
    try { fn(); } finally {
      Object.keys(snapshot).forEach(function (k) { PHCStore.set(k, snapshot[k]); });
    }
  }

  test("staff login: the demo staff account signs in with a staff session", function () {
    withFreshStore(function () {
      equal(PHCStaffAuth.login(" Staff@PHC.example ", "staff1234").ok, true);
      equal(PHCStore.session().role, "staff");
      equal(PHCStaffAuth.current().id, "s1");
    });
  });

  test("staff login: a wrong password is refused and no session is set", function () {
    withFreshStore(function () {
      var r = PHCStaffAuth.login("staff@phc.example", "wrong");
      equal(r.ok, false);
      equal(r.error, "Incorrect email or password");
      equal(PHCStore.session(), null);
    });
  });

  test("staff access: a customer session is not staff", function () {
    withFreshStore(function () {
      PHCStore.setSession({ role: "customer", id: "c1" });
      equal(PHCStaffAuth.current(), null);
    });
  });

  test("customerFromQuery: the verified caller from US12 is selected by id", function () {
    equal(S.customerFromQuery(CUSTOMERS, "?customer=c1").name, "Sarah Jones");
    equal(S.customerFromQuery(CUSTOMERS, "?customer=%20c1%20").id, "c1");
  });

  test("customerFromQuery: unknown, empty or missing customer id selects nobody", function () {
    equal(S.customerFromQuery(CUSTOMERS, "?customer=c999"), null);
    equal(S.customerFromQuery(CUSTOMERS, "?customer="), null);
    equal(S.customerFromQuery(CUSTOMERS, ""), null);
    equal(S.customerFromQuery([], "?customer=c1"), null);
  });

  test("findCustomers: finds by phone with or without spaces and +44", function () {
    equal(S.findCustomers(CUSTOMERS, "07123456789").length, 1);
    equal(S.findCustomers(CUSTOMERS, "+44 7123 456789").length, 1);
  });

  test("findCustomers: finds by email in any case", function () {
    equal(S.findCustomers(CUSTOMERS, "SARAH@example.com")[0].id, "c1");
  });

  test("findCustomers: an unknown caller or a short number finds nobody", function () {
    equal(S.findCustomers(CUSTOMERS, "07999 999999").length, 0);
    equal(S.findCustomers(CUSTOMERS, "0712").length, 0);
    equal(S.findCustomers(CUSTOMERS, "").length, 0);
  });

  test("validateNewCustomer: a complete new customer is valid", function () {
    var r = S.validateNewCustomer({ name: "Tom Lee", email: "tom@example.com", phone: "07700 900999", address: "2 Low St", postcode: "e1 6an" }, CUSTOMERS);
    equal(r.valid, true);
  });

  test("validateNewCustomer: duplicate email and phone are refused", function () {
    var r = S.validateNewCustomer({ name: "Sarah J", email: "sarah@example.com", phone: "07123 456789", address: "1 High St", postcode: "E1 6AN" }, CUSTOMERS);
    equal(r.errors.email, "A customer with this email already exists");
    equal(r.errors.phone, "A customer with this phone number already exists");
  });

  test("validateNewCustomer: every missing field has a message", function () {
    var r = S.validateNewCustomer({}, CUSTOMERS);
    equal(Object.keys(r.errors).sort().join(","), "address,email,name,phone,postcode");
  });

  test("buildCustomer: created by staff with no password", function () {
    var c = S.buildCustomer({ name: " Tom Lee ", email: "Tom@Example.com", phone: "07700 900999", address: "2 Low St", postcode: "e1 6an" }, "c9");
    equal(c.email, "tom@example.com");
    equal(c.postcode, "E1 6AN");
    equal(c.password, "");
    equal(c.createdBy, "staff");
  });

  test("validateStaffBooking: complete details are valid", function () {
    equal(S.validateStaffBooking(details(), service("local"), NOW).valid, true);
  });

  test("validateStaffBooking: every required field missing is reported", function () {
    var r = S.validateStaffBooking({}, null, NOW);
    equal(Object.keys(r.errors).sort().join(","), "carSize,channel,date,destination,passengers,pickup,service,time");
  });

  test("validateStaffBooking: missing channel blocks the save", function () {
    equal(S.validateStaffBooking(details({ channel: "" }), service("local"), NOW).errors.channel, "Choose phone or in person");
  });

  test("validateStaffBooking: daily hire needs hours", function () {
    equal(S.validateStaffBooking(details(), service("daily-hire"), NOW).errors.hours, "Enter the number of hours, from 1 to 12");
    equal(S.validateStaffBooking(details({ hours: 3 }), service("daily-hire"), NOW).valid, true);
  });

  test("price: phone and in-person bookings get no online discount", function () {
    equal(S.price(service("airport"), null, "phone").total, 45);
    equal(S.price(service("airport"), null, "in-person").discount, 0);
  });

  test("price: an online booking still gets 15% off", function () {
    equal(S.price(service("airport"), null, "online").total, 38.25);
  });

  test("buildBooking: a phone booking is Standard, unpaid and at full price", function () {
    var b = S.buildBooking({
      id: "b9", customer: { id: "c1" }, service: service("daily-hire"), details: details({ hours: 2 }),
      pickupAt: "2026-12-05T10:30:00", channel: "phone", staffId: "s1", createdAt: "2026-12-01T09:00:00Z"
    });
    equal(b.tag, "Standard");
    equal(b.status, "unpaid");
    equal(b.total, 70);
    equal(b.hours, 2);
    equal(b.createdBy, "s1");
  });

  test("sessionChanged: a write from another tab by the same staff keeps the page", function () {
    equal(S.sessionChanged("staff:s1", "staff:s1"), false);
    equal(S.sessionChanged("", ""), false);
  });

  test("sessionChanged: sign in, sign out or another account redraws the page", function () {
    equal(S.sessionChanged("", "staff:s1"), true);
    equal(S.sessionChanged("staff:s1", ""), true);
    equal(S.sessionChanged("staff:s1", "staff:s2"), true);
    equal(S.sessionChanged("staff:s1", "customer:c1"), true);
  });
})();
