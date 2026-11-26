/* PHC-13 / US15: pure validation & record-building rules, no browser storage. */
var PHCStaffRules = (function () {
  "use strict";

  function text(value) { return typeof value === "string" ? value.trim() : ""; }
  function registrationKey(value) { return text(value).replace(/\s+/g, "").toUpperCase(); }
  function normaliseRegistration(value) { return text(value).replace(/\s+/g, " ").toUpperCase(); }
  function normalisePhone(value) { return text(value).replace(/[\s()-]/g, ""); }
  function validPhone(value) { return /^0\d{10}$/.test(normalisePhone(value)); }
  function normaliseLicence(value) { return text(value).toUpperCase(); }
  function validLicence(value) { return /^[A-Z0-9]{16}$/.test(normaliseLicence(value)); }
  function validEmail(value) { var email = text(value); return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }
  function arr(value) { return Array.isArray(value) ? value : []; }

  function validateCar(input, cars, drivers) {
    input = input || {};
    var errors = {};
    var registration = normaliseRegistration(input.registration);
    var regKey = registrationKey(registration);
    var make = text(input.make);
    var colour = text(input.colour);
    var size = String(input.size == null ? "" : input.size).trim();
    var driverId = text(input.driverId);
    if (!regKey) errors.registration = "Enter the vehicle registration.";
    else if (arr(cars).some(function (car) { return registrationKey(car.registration) === regKey; })) errors.registration = "Vehicle already registered";
    if (!make) errors.make = "Enter the vehicle make.";
    if (!colour) errors.colour = "Enter the vehicle colour.";
    if (size !== "4" && size !== "7") errors.size = "Choose 4 or 7 seats.";
    if (driverId) {
      if (!arr(drivers).some(function (driver) { return driver.id === driverId; })) errors.driverId = "Choose a registered driver.";
      else if (arr(cars).some(function (car) { return car.driverId === driverId; })) errors.driverId = "This driver is already assigned to another vehicle.";
    }
    return { ok: !Object.keys(errors).length, errors: errors, value: {
      registration: registration, make: make, colour: colour, size: Number(size), driverId: driverId || null
    } };
  }

  function createCar(id, input, cars, drivers) {
    var checked = validateCar(input, cars, drivers);
    if (!checked.ok) return { ok: false, errors: checked.errors };
    if (!text(id)) return { ok: false, errors: { form: "Invalid vehicle ID." } };
    return { ok: true, value: {
      id: String(id), registration: checked.value.registration, make: checked.value.make,
      colour: checked.value.colour, size: checked.value.size, status: "available", driverId: checked.value.driverId
    } };
  }

  function validateDriver(input, drivers, cars) {
    input = input || {};
    var errors = {};
    var name = text(input.name);
    var licenceNumber = normaliseLicence(input.licenceNumber);
    var phone = normalisePhone(input.phone);
    var carId = text(input.carId);
    if (!name) errors.name = "Enter the driver's full name.";
    if (!validLicence(licenceNumber)) errors.licenceNumber = "Licence number is not valid";
    else if (arr(drivers).some(function (driver) { return normaliseLicence(driver.licenceNumber) === licenceNumber; })) errors.licenceNumber = "Licence number already registered";
    if (!validPhone(phone)) errors.phone = "Enter an 11-digit UK phone number";
    if (carId) {
      var car = arr(cars).find(function (vehicle) { return vehicle.id === carId; });
      if (!car) errors.carId = "Choose a registered vehicle.";
      else if (car.driverId) errors.carId = "This vehicle already has an assigned driver.";
    }
    return { ok: !Object.keys(errors).length, errors: errors, value: {
      name: name, licenceNumber: licenceNumber, phone: phone, carId: carId || null
    } };
  }

  function createDriver(id, input, drivers, cars) {
    var checked = validateDriver(input, drivers, cars);
    if (!checked.ok) return { ok: false, errors: checked.errors };
    if (!text(id)) return { ok: false, errors: { form: "Invalid driver ID." } };
    return { ok: true, value: {
      id: String(id), name: checked.value.name, licenceNumber: checked.value.licenceNumber,
      phone: checked.value.phone
    }, assignedCarId: checked.value.carId };
  }

  function validateCustomer(input, customers) {
    input = input || {};
    var errors = {};
    var name = text(input.name);
    var email = text(input.email).toLowerCase();
    var phone = normalisePhone(input.phone);
    var address = text(input.address);
    var password = typeof input.password === "string" ? input.password : "";
    if (!name) errors.name = "Enter the customer's full name.";
    if (!validEmail(email)) errors.email = "Enter a valid email address.";
    else if (arr(customers).some(function (customer) { return text(customer.email).toLowerCase() === email; })) errors.email = "An account with this email already exists.";
    if (!validPhone(phone)) errors.phone = "Enter an 11-digit UK phone number";
    if (!address) errors.address = "Enter the customer's address.";
    if (password.length < 8) errors.password = "Password must be at least 8 characters.";
    return { ok: !Object.keys(errors).length, errors: errors, value: {
      name: name, email: email, phone: phone, address: address, password: password
    } };
  }

  function createCustomer(id, input, customers) {
    var checked = validateCustomer(input, customers);
    if (!checked.ok) return { ok: false, errors: checked.errors };
    if (!text(id)) return { ok: false, errors: { form: "Invalid customer ID." } };
    return { ok: true, value: {
      id: String(id), name: checked.value.name, email: checked.value.email,
      phone: checked.value.phone, address: checked.value.address,
      password: checked.value.password, bookings: []
    } };
  }

  return {
    registrationKey: registrationKey, normaliseRegistration: normaliseRegistration,
    normalisePhone: normalisePhone, validPhone: validPhone,
    normaliseLicence: normaliseLicence, validLicence: validLicence,
    validateCar: validateCar, createCar: createCar,
    validateDriver: validateDriver, createDriver: createDriver,
    validateCustomer: validateCustomer, createCustomer: createCustomer
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = PHCStaffRules;
