/*
 * PHCRules - business rules as PURE functions.
 * - No DOM, no localStorage, no Date.now(): the caller passes "now".
 * - "now" may be a Date, a timestamp in ms, or an ISO string.
 *
 * Booking fields used here (team: confirm in Sprint 1 planning):
 *   booking.pickupAt  ISO date-time string of the pick-up, e.g. "2026-12-01T09:30:00"
 *   booking.status    "confirmed" | "cancelled" | ... (a cancelled or completed booking cannot be changed)
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
    if (!booking || booking.status === "cancelled" || booking.status === "completed") return false;
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

  // ---------- US05: booking details ----------

  var CAR_SIZES = [4, 7];           // passenger seats of the cars in the fleet
  var MAX_HIRE_HOURS = 12;          // daily hire: 1 to 12 hours per booking
  var FUTURE_MESSAGE = "Date and time must be in the future";

  function asText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /**
   * Joins a date ("YYYY-MM-DD") and a time ("HH:MM") into a local ISO date-time
   * string "YYYY-MM-DDTHH:MM:00" (the booking.pickupAt format).
   * Returns "" if either part is missing or not a real calendar date/time (e.g. 2026-02-30, 25:00).
   */
  function combineDateTime(date, time) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asText(date));
    var t = /^(\d{2}):(\d{2})$/.exec(asText(time));
    if (!d || !t) return "";
    var y = +d[1], mo = +d[2], day = +d[3], h = +t[1], mi = +t[2];
    if (h > 23 || mi > 59) return "";
    var check = new Date(y, mo - 1, day, h, mi);
    if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== day) return "";
    return d[1] + "-" + d[2] + "-" + d[3] + "T" + pad2(h) + ":" + pad2(mi) + ":00";
  }

  /**
   * Smallest car size (4 or 7) that seats the passengers, or null if no car is big enough.
   */
  function suggestCarSize(passengers) {
    for (var i = 0; i < CAR_SIZES.length; i++) {
      if (passengers <= CAR_SIZES[i]) return CAR_SIZES[i];
    }
    return null;
  }

  /**
   * Priority tag of a booking by channel: online bookings are "Priority" over phone bookings ("Standard").
   */
  function bookingTag(channel) {
    return channel === "online" ? "Priority" : "Standard";
  }

  /**
   * Validates the journey details of a booking (US05).
   * @param {object} details {pickup, destination, date "YYYY-MM-DD", time "HH:MM",
   *                          passengers, carSize (4|7), byTime (bool), hours (needed when byTime)}
   * @param {Date|number|string} now  the current time (passed in to keep this function pure)
   * @returns {{valid:boolean, errors:object, pickupAt:string, suggestedCarSize:(number|null)}}
   *   errors maps a field name (pickup, destination, date, time, passengers, carSize, hours) to a message.
   * Throws RangeError if "now" is not a valid date (a programming mistake, not a user error).
   */
  function validateBooking(details, now) {
    var current = toTime(now);
    if (!isFinite(current)) {
      throw new RangeError("validateBooking: a valid 'now' is required");
    }
    var d = details || {};
    var errors = {};
    var pickupAt = "";
    var suggestedCarSize = null;

    var pickup = asText(d.pickup);
    var destination = asText(d.destination);
    if (!pickup) errors.pickup = "Enter a pick-up address";
    else if (pickup.length < 3) errors.pickup = "Pick-up address is too short";
    if (!destination) errors.destination = "Enter a destination";
    else if (destination.length < 3) errors.destination = "Destination is too short";
    else if (pickup && destination.toLowerCase() === pickup.toLowerCase()) {
      errors.destination = "Destination must be different from the pick-up address";
    }

    var dateText = asText(d.date);
    var timeText = asText(d.time);
    if (!dateText) errors.date = "Choose a date";
    if (!timeText) errors.time = "Choose a time";
    if (dateText && timeText) {
      pickupAt = combineDateTime(dateText, timeText);
      if (!pickupAt) {
        errors.date = "Enter a valid date and time";
      } else if (new Date(pickupAt).getTime() <= current) {
        errors.date = FUTURE_MESSAGE;
        pickupAt = "";
      }
    }

    var maxSeats = CAR_SIZES[CAR_SIZES.length - 1];
    var passengersOk = false;
    var passengers = d.passengers === "" || d.passengers == null ? NaN : Number(d.passengers);
    if (d.passengers === "" || d.passengers == null) {
      errors.passengers = "Enter the number of passengers";
    } else if (!isFinite(passengers) || Math.floor(passengers) !== passengers || passengers < 1) {
      errors.passengers = "Passengers must be a whole number from 1 to " + maxSeats;
    } else if (passengers > maxSeats) {
      errors.passengers = "One car takes up to " + maxSeats + " passengers. Please make a second booking for the rest of your group.";
    } else {
      passengersOk = true;
    }

    var carSize = Number(d.carSize);
    if (CAR_SIZES.indexOf(carSize) === -1) {
      errors.carSize = "Choose a car size";
    } else if (passengersOk && passengers > carSize) {
      suggestedCarSize = suggestCarSize(passengers);
      errors.carSize = "A " + carSize + "-seater takes up to " + carSize + " passengers. Choose a " +
        suggestedCarSize + "-seater for " + passengers + " passengers.";
    }

    if (d.byTime) {
      var hours = d.hours === "" || d.hours == null ? NaN : Number(d.hours);
      if (!isFinite(hours) || Math.floor(hours) !== hours || hours < 1 || hours > MAX_HIRE_HOURS) {
        errors.hours = "Enter the number of hours, from 1 to " + MAX_HIRE_HOURS;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      pickupAt: pickupAt,
      suggestedCarSize: suggestedCarSize
    };
  }

  return {
    HOURS_BEFORE_CHANGE: HOURS_BEFORE_CHANGE,
    ONLINE_DISCOUNT: ONLINE_DISCOUNT,
    CAR_SIZES: CAR_SIZES,
    MAX_HIRE_HOURS: MAX_HIRE_HOURS,
    FUTURE_MESSAGE: FUTURE_MESSAGE,
    hoursUntilPickup: hoursUntilPickup,
    canChangeBooking: canChangeBooking,
    baseFare: baseFare,
    applyOnlineDiscount: applyOnlineDiscount,
    combineDateTime: combineDateTime,
    suggestCarSize: suggestCarSize,
    bookingTag: bookingTag,
    validateBooking: validateBooking
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCRules;
}
