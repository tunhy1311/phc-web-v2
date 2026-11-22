/*
 * PHCRules - business rules as PURE functions.
 * - No DOM, no localStorage, no Date.now(): the caller passes "now".
 * - "now" may be a Date, a timestamp in ms, or an ISO string.
 *
 * Booking fields used here (team: confirm in Sprint 1 planning):
 *   booking.pickupAt  ISO date-time string of the pick-up, e.g. "2026-12-01T09:30:00"
 *   booking.status    "confirmed" | "cancelled" | ... (a cancelled booking cannot be changed)
 */
var PHCRules = (function () {
  "use strict";

  var HOURS_BEFORE_CHANGE = 24; // cancel/amend allowed only if pick-up is >= 24h away
  var ONLINE_DISCOUNT = 0.15;   // 15% off for online bookings
  var HOUR_MS = 60 * 60 * 1000;

  function toTime(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") return new Date(value).getTime();
    return NaN;
  }

  function roundMoney(x) {
    return Math.round(x * 100) / 100;
  }

  /**
   * Hours between now and the booking's pick-up (negative if already in the past).
   * Returns NaN if either date is invalid.
   */
  function hoursUntilPickup(booking, now) {
    if (!booking) return NaN;
    var pickup = toTime(booking.pickupAt);
    var current = toTime(now);
    if (!isFinite(pickup) || !isFinite(current)) return NaN;
    return (pickup - current) / HOUR_MS;
  }

  /**
   * US: customer may cancel or amend a booking only if the pick-up
   * is at least 24 hours away (exactly 24h counts as allowed).
   * Returns false for cancelled bookings and for invalid input.
   */
  function canChangeBooking(booking, now) {
    if (!booking || booking.status === "cancelled") return false;
    var hours = hoursUntilPickup(booking, now);
    if (!isFinite(hours)) return false;
    return hours >= HOURS_BEFORE_CHANGE;
  }

  /**
   * Base fare before any discount, in GBP.
   * SPRINT 0 RULE (placeholder for the pricing owner to refine, e.g. by distance):
   *   - byTime services (Driver & car daily hire): fromPrice x hours, minimum 1 hour
   *   - all other services: fromPrice
   * @param {object} service  an item of PHC_DATA.services
   * @param {object} [options] {hours}
   * Throws RangeError on invalid input so mistakes show up during development.
   */
  function baseFare(service, options) {
    if (!service || typeof service.fromPrice !== "number" || !isFinite(service.fromPrice) || service.fromPrice < 0) {
      throw new RangeError("baseFare: service with a valid fromPrice is required");
    }
    if (service.byTime) {
      var hours = options && options.hours;
      if (typeof hours !== "number" || !isFinite(hours) || hours < 1) {
        throw new RangeError("baseFare: hours >= 1 is required for byTime services");
      }
      return roundMoney(service.fromPrice * hours);
    }
    return roundMoney(service.fromPrice);
  }

  /**
   * Applies the 15% online discount. Returns the new total rounded to pence.
   */
  function applyOnlineDiscount(total) {
    if (typeof total !== "number" || !isFinite(total) || total < 0) {
      throw new RangeError("applyOnlineDiscount: total must be a number >= 0");
    }
    return roundMoney(total * (1 - ONLINE_DISCOUNT));
  }

  return {
    HOURS_BEFORE_CHANGE: HOURS_BEFORE_CHANGE,
    ONLINE_DISCOUNT: ONLINE_DISCOUNT,
    hoursUntilPickup: hoursUntilPickup,
    canChangeBooking: canChangeBooking,
    baseFare: baseFare,
    applyOnlineDiscount: applyOnlineDiscount
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCRules;
}
