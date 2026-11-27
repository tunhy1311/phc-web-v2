/* PHC-22 / US07: pure notification rules (no DOM, storage or real messaging).
 * Load after js/data.js. Valid methods: email, text, both.
 */
var PHCNotifications = (function () {
  "use strict";
  var PHONE_ERROR = "Enter an 11-digit UK phone number";
  var METHODS = ["email", "text", "both"];

  function normalisePhone(value) {
    return String(value == null ? "" : value).replace(/[\s()-]/g, "");
  }
  function validPhone(value) {
    return /^0\d{10}$/.test(normalisePhone(value));
  }
  function channels(method) {
    if (METHODS.indexOf(method) < 0) return [];
    return method === "both" ? ["email", "text"] : [method];
  }
  function validatePreference(method, phone) {
    var errors = {};
    if (METHODS.indexOf(method) < 0) errors.method = "Choose Email, Text or Both.";
    if (channels(method).indexOf("text") >= 0 && !validPhone(phone)) {
      errors.phone = PHONE_ERROR;
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }
  function confirmedBooking(booking) {
    return !!booking && booking.status === "confirmed";
  }
  // The current main saves a new booking as unpaid until payment succeeds.
  // Choosing notification preferences is allowed before payment; driver alerts are not.
  function canChoosePreference(booking) {
    return !!booking && (booking.status === "unpaid" || booking.status === "confirmed");
  }
  function belongsToCustomer(booking, session) {
    return canChoosePreference(booking) && !!session && session.role === "customer" &&
      String(booking.customerId) === String(session.id);
  }
  function savePreference(booking, method, phone, now) {
    var result = validatePreference(method, phone);
    if (!canChoosePreference(booking)) return { ok: false, errors: { form: "Only active bookings can set notification preferences." } };
    if (!result.valid) return { ok: false, errors: result.errors };
    var updated = JSON.parse(JSON.stringify(booking));
    updated.notification = {
      method: method,
      phone: channels(method).indexOf("text") >= 0 ? normalisePhone(phone) : "",
      savedAt: new Date(now == null ? Date.now() : now).toISOString()
    };
    return { ok: true, booking: updated, errors: {} };
  }

  function canAssignCar(booking, car, drivers) {
      if (!confirmedBooking(booking) || !car || !car.driverId) return false;
      if (car.status !== "available") return false;
      if (Number(car.size) < Number(booking.carSize || booking.passengers || 1)) return false;
      return (drivers || []).some(function (d) { return d.id === car.driverId; });
  }

  function createApproachPreview(booking, car, driver, customer, minutes, now) {
    if (!confirmedBooking(booking)) return { ok: false, error: "Select a confirmed booking." };
    if (!booking.notification || !channels(booking.notification.method).length) {
      return { ok: false, error: "The customer must choose notification preferences first." };
    }
    if (!car || car.status !== "available" || !driver ||
      car.driverId !== driver.id ||
      Number(car.size) < Number(booking.carSize)) {
      return {
          ok: false,
          error: "Choose an available car with its assigned driver."
      };
  }

    if (!Number.isInteger(Number(minutes)) || Number(minutes) < 10 || Number(minutes) > 15) {
      return { ok: false, error: "Estimated arrival must be 10–15 minutes." };
    }
    var method = booking.notification.method;
    if (channels(method).indexOf("text") >= 0 && !validPhone(booking.notification.phone)) {
      return { ok: false, error: PHONE_ERROR };
    }
    var vehicleText = [car.registration, car.colour, car.make].join(" · ");
    var message = "PrivateHire Cars: Your driver " + driver.name + " is about " + minutes +
      " minutes away. Vehicle: " + car.registration + ", " + car.colour + " " + car.make + ".";
    var email = "Booking " + String(booking.id).toUpperCase() + " — driver approaching\n" + message;
    var updated = JSON.parse(JSON.stringify(booking));
    updated.assignedCarId = car.id;
    updated.assignedDriverId = driver.id;
    updated.driverApproach = {
      minutes: Number(minutes), triggeredAt: new Date(now == null ? Date.now() : now).toISOString(),
      delivery: method
    };
    return {
      ok: true, booking: updated, vehicleText: vehicleText,
      emailPreview: channels(method).indexOf("email") >= 0 ? email : null,
      textPreview: channels(method).indexOf("text") >= 0 ? message : null,
      emailTo: channels(method).indexOf("email") >= 0 && customer ? customer.email : "",
      textTo: channels(method).indexOf("text") >= 0 ? booking.notification.phone : ""
    };
  }
  return {
    PHONE_ERROR: PHONE_ERROR, normalisePhone: normalisePhone, validPhone: validPhone,
    channels: channels, validatePreference: validatePreference, confirmedBooking: confirmedBooking,
    canChoosePreference: canChoosePreference,
    belongsToCustomer: belongsToCustomer, savePreference: savePreference,
    canAssignCar: canAssignCar, createApproachPreview: createApproachPreview
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = PHCNotifications;
