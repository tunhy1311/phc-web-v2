/* PHC-13 / US15: acceptance-criteria tests for pure Fleet & Accounts rules. */
(function () {
  "use strict";
  var R = PHCStaffRules;
  var T = PHCTest;
  var cars = [
    { id: "car1", registration: "LB19 XKT", make: "Toyota Prius", colour: "Black", size: 4, status: "available", driverId: "d1" },
    { id: "car2", registration: "LK70 BWE", make: "Ford Galaxy", colour: "Blue", size: 7, status: "available", driverId: null }
  ];
  var drivers = [{ id: "d1", name: "James Carter", phone: "07700 900101", licenceNumber: "SMITH70123AB9CD0" }];
  var customers = [{ id: "c1", name: "Sarah Jones", email: "sarah@example.com" }];
  var car = { registration: "AB26 CDE", make: "Toyota Corolla", colour: "White", size: "4", driverId: "" };
  var driver = { name: "Alex Morgan", licenceNumber: "MORGAN70123AB9CD", phone: "07123 456789", carId: "" };
  var customer = { name: "Jamie Taylor", email: "jamie@example.com", phone: "07123 456789", address: "10 Baker Street", password: "demo12345" };
  function edit(value, keys) { return Object.assign({}, value, keys); }

  T.test("US15 AC1: valid four-seater minicab can be created", function () {
    var result = R.createCar("car99", car, cars, drivers);
    T.equal(result.ok, true); T.equal(result.value.size, 4); T.equal(result.value.status, "available");
  });
  T.test("US15 AC1: valid seven-seater minicab can be created", function () {
    var result = R.createCar("car99", edit(car, { size: "7" }), cars, drivers);
    T.equal(result.ok, true); T.equal(result.value.size, 7);
  });
  T.test("US15 AC1: missing vehicle registration rejected", function () {
    T.equal(R.validateCar(edit(car, { registration: "  " }), cars, drivers).ok, false);
  });
  T.test("US15 AC1: missing make rejected", function () {
    T.equal(!!R.validateCar(edit(car, { make: "" }), cars, drivers).errors.make, true);
  });
  T.test("US15 AC1: missing colour rejected", function () {
    T.equal(!!R.validateCar(edit(car, { colour: "" }), cars, drivers).errors.colour, true);
  });
  T.test("US15 AC1: invalid seat count rejected", function () {
    T.equal(!!R.validateCar(edit(car, { size: "5" }), cars, drivers).errors.size, true);
  });
  T.test("US15 AC2: duplicate registration blocked", function () {
    T.equal(R.validateCar(edit(car, { registration: "LB19 XKT" }), cars, drivers).errors.registration, "Vehicle already registered");
  });
  T.test("US15 AC2: duplicate registration blocked regardless of case or spaces", function () {
    T.equal(R.validateCar(edit(car, { registration: " lb19xkt " }), cars, drivers).errors.registration, "Vehicle already registered");
  });
  T.test("US15: vehicle registration normalised on save", function () {
    T.equal(R.createCar("car99", edit(car, { registration: " ab26    cde " }), cars, drivers).value.registration, "AB26 CDE");
  });
  T.test("US15: new car can be assigned an available driver", function () {
    var list = drivers.concat([{ id: "d2", name: "Alex Morgan" }]);
    T.equal(R.createCar("car99", edit(car, { driverId: "d2" }), cars, list).value.driverId, "d2");
  });
  T.test("US15: cannot assign same driver to two cars", function () {
    T.equal(!!R.validateCar(edit(car, { driverId: "d1" }), cars, drivers).errors.driverId, true);
  });
  T.test("US15 AC3: valid driver saved with phone and licence", function () {
    var result = R.createDriver("d99", driver, drivers, cars);
    T.equal(result.ok, true); T.equal(result.value.phone, "07123456789"); T.equal(result.value.licenceNumber, "MORGAN70123AB9CD");
  });
  T.test("US15 AC3: driver licence exactly 16 letters/digits", function () {
    T.equal(R.validLicence("MORGAN70123AB9CD"), true);
    T.equal(R.validLicence("SHORT123"), false);
    T.equal(R.validLicence("MORGAN70 234AB9CD"), false);
    T.equal(R.validLicence("MORGAN70123AB9CD!"), false);
  });
  T.test("US15 AC3: invalid licence reports acceptance message", function () {
    T.equal(R.validateDriver(edit(driver, { licenceNumber: "123" }), drivers, cars).errors.licenceNumber, "Licence number is not valid");
  });
  T.test("US15 AC3: invalid phone blocked", function () {
    T.equal(R.validateDriver(edit(driver, { phone: "07123" }), drivers, cars).errors.phone, "Enter an 11-digit UK phone number");
  });
  T.test("US15 AC3: phone number must begin with 0", function () {
    T.equal(R.validPhone("17123456789"), false);
  });
  T.test("US15 AC3: duplicate licence is blocked", function () {
    T.equal(R.validateDriver(edit(driver, { licenceNumber: "SMITH70123AB9CD0" }), drivers, cars).errors.licenceNumber, "Licence number already registered");
  });
  T.test("US15: missing driver name is rejected", function () {
    T.equal(!!R.validateDriver(edit(driver, { name: "" }), drivers, cars).errors.name, true);
  });
  T.test("US15 AC4: new driver can be attached to an unassigned car", function () {
    var result = R.createDriver("d99", edit(driver, { carId: "car2" }), drivers, cars);
    T.equal(result.ok, true); T.equal(result.assignedCarId, "car2");
  });
  T.test("US15 AC4: cannot attach new driver to an occupied car", function () {
    T.equal(!!R.validateDriver(edit(driver, { carId: "car1" }), drivers, cars).errors.carId, true);
  });
  T.test("US15 AC5: staff creates customer with credentials compatible with login", function () {
    var result = R.createCustomer("c99", customer, customers);
    T.equal(result.ok, true); T.equal(result.value.email, "jamie@example.com"); T.equal(result.value.password, "demo12345");
    T.equal(Array.isArray(result.value.bookings), true);
  });
  T.test("US15 AC5: duplicate customer email blocked case-insensitively", function () {
    T.equal(!!R.validateCustomer(edit(customer, { email: " SARAH@EXAMPLE.COM " }), customers).errors.email, true);
  });
  T.test("US15 AC5: invalid email blocked", function () {
    T.equal(!!R.validateCustomer(edit(customer, { email: "not-an-email" }), customers).errors.email, true);
  });
  T.test("US15 AC5: customer password at least eight chars", function () {
    T.equal(!!R.validateCustomer(edit(customer, { password: "short" }), customers).errors.password, true);
  });
  T.test("US15 AC5: invalid customer phone rejected", function () {
    T.equal(!!R.validateCustomer(edit(customer, { phone: "123" }), customers).errors.phone, true);
  });
  T.test("US15 AC5: customer address required", function () {
    T.equal(!!R.validateCustomer(edit(customer, { address: "" }), customers).errors.address, true);
  });
  T.test("US15: input lists are not mutated", function () {
    var snapshot = JSON.stringify([cars, drivers, customers, car, driver, customer]);
    R.createCar("car99", car, cars, drivers); R.createDriver("d99", driver, drivers, cars); R.createCustomer("c99", customer, customers);
    T.equal(JSON.stringify([cars, drivers, customers, car, driver, customer]), snapshot);
  });
})();
