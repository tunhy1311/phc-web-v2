/*
 * PHCBookingChanges - cancel or amend a booking (PHC-25 / US10). Owner: Huy.
 * Pure functions: no DOM, no localStorage, no Date.now(). The caller passes "now"
 * (a Date, a timestamp in ms or an ISO string) and saves the returned booking with PHCStore.
 * Load after: data.js, rules.js.
 *
 *   PHCBookingChanges.RULE_MESSAGE
 *   PHCBookingChanges.statusLabel(booking)       -> "Cancelled" | "Unpaid" | "Confirmed"
 *        status "unpaid" is set by US08 (payment) until the booking is paid; "cancelled" is set by cancelBooking.
 *   PHCBookingChanges.checkChange(booking, now)  -> {allowed, reason}
 *        allowed = PHCRules.canChangeBooking (pick-up at least 24h away, exactly 24h is allowed).
 *        reason explains the 24-hour rule when the change is refused.
 *   PHCBookingChanges.cancelBooking(booking, now) -> {ok, booking?, error?}
 *        booking.status becomes "cancelled" and booking.cancelledAt is set (ISO string).
 *   PHCBookingChanges.priceFor(booking, service)  -> {base, discount, total}
 *        Online bookings get the 15% discount (PHCRules.applyOnlineDiscount); other channels pay the base fare.
 *   PHCBookingChanges.amendBooking(booking, changes, now) -> {ok, errors, booking?, price?, previousTotal?}
 *        changes = {date "YYYY-MM-DD", time "HH:MM", carSize (4|7)}. Only the pick-up time and the car size
 *        can be amended. On success booking has the new pickupAt, carSize, baseFare, discount, total and
 *        amendedAt (ISO string). errors maps date, time, carSize or form to a message.
 *
 * Booking fields used: see js/book-details.js (id, serviceId, hours, pickup, destination, pickupAt,
 * passengers, carSize, baseFare, discount, total, channel, status).
 */
var PHCBookingChanges = (function () {
  "use strict";

  var RULE_MESSAGE = "Bookings can only be cancelled or amended up to 24 hours before pick-up. " +
    "Your pick-up is less than 24 hours away, so please call us to make a change.";

  function toTime(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") return new Date(value).getTime();
    return NaN;
  }

  function nowIso(now) {
    var t = toTime(now);
    if (!isFinite(t)) throw new RangeError("PHCBookingChanges: a valid 'now' is required");
    return new Date(t).toISOString();
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function findService(id) {
    var list = typeof PHC_DATA !== "undefined" && PHC_DATA.services ? PHC_DATA.services : [];
    return list.filter(function (s) { return s.id === id; })[0] || null;
  }

  function statusLabel(booking) {
    if (booking && booking.status === "cancelled") return "Cancelled";
    if (booking && booking.status === "unpaid") return "Unpaid";
    return "Confirmed";
  }

  function checkChange(booking, now) {
    if (!booking) return { allowed: false, reason: "Booking not found." };
    if (booking.status === "cancelled") {
      return { allowed: false, reason: "This booking is already cancelled." };
    }
    var hours = PHCRules.hoursUntilPickup(booking, now);
    if (!isFinite(hours)) {
      return { allowed: false, reason: "This booking has no valid pick-up time, so it cannot be changed." };
    }
    if (hours < 0) {
      return { allowed: false, reason: "This journey has already started or finished, so it cannot be changed." };
    }
    if (!PHCRules.canChangeBooking(booking, now)) {
      return { allowed: false, reason: RULE_MESSAGE };
    }
    return { allowed: true, reason: "" };
  }

  function cancelBooking(booking, now) {
    var check = checkChange(booking, now);
    if (!check.allowed) return { ok: false, error: check.reason };
    var updated = clone(booking);
    updated.status = "cancelled";
    updated.cancelledAt = nowIso(now);
    return { ok: true, booking: updated };
  }

  function priceFor(booking, service) {
    var base = PHCRules.baseFare(service, service.byTime ? { hours: Number(booking.hours) } : undefined);
    if (booking.channel !== "online") return { base: base, discount: 0, total: base };
    var total = PHCRules.applyOnlineDiscount(base);
    return { base: base, discount: Math.round((base - total) * 100) / 100, total: total };
  }

  function amendBooking(booking, changes, now, fleet) {
    var check = checkChange(booking, now);
    if (!check.allowed) return { ok: false, errors: { form: check.reason } };

    var service = findService(booking.serviceId);
    if (!service) return { ok: false, errors: { form: "The service of this booking is no longer available." } };

    var c = changes || {};
    var result = PHCRules.validateBooking({
      pickup: booking.pickup,
      destination: booking.destination,
      date: c.date,
      time: c.time,
      passengers: booking.passengers,
      carSize: c.carSize,
      byTime: service.byTime,
      hours: booking.hours
    }, now);

    // Only the fields the customer can amend are reported.
    var errors = {};
    ["date", "time", "carSize"].forEach(function (field) {
      if (result.errors[field]) errors[field] = result.errors[field];
    });
    var others = Object.keys(result.errors).filter(function (f) { return !errors[f]; });
    if (others.length && !Object.keys(errors).length) {
      errors.form = "Some details of this booking are not valid, so it cannot be amended online.";
    }
    if (Object.keys(errors).length) return { ok: false, errors: errors };

    if (result.pickupAt === booking.pickupAt && Number(c.carSize) === Number(booking.carSize)) {
      return { ok: false, errors: { form: "Nothing has changed. Choose a new date, time or car size." } };
    }

    var updated = clone(booking);
    updated.pickupAt = result.pickupAt;
    updated.carSize = Number(c.carSize);
    // The current booking is deliberately excluded: it is being replaced, not competing.
    if (fleet) {
      var car = PHCVehicleAssignment.findAvailableCar(
        updated, fleet.cars || [], fleet.bookings || [], booking.id
      );
      if (!car) {
        return { ok: false, errors: { form: "No suitable vehicle is available for this time. Please choose another date, time or car size." } };
      }
      updated.carId = car.id;
      updated.carModel = car.make;
    }
    var price = priceFor(updated, service);
    updated.baseFare = price.base;
    updated.discount = price.discount;
    updated.total = price.total;
    updated.amendedAt = nowIso(now);
    return { ok: true, errors: {}, booking: updated, price: price, previousTotal: booking.total };
  }

  return {
    RULE_MESSAGE: RULE_MESSAGE,
    statusLabel: statusLabel,
    checkChange: checkChange,
    cancelBooking: cancelBooking,
    priceFor: priceFor,
    amendBooking: amendBooking
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCBookingChanges;
}
