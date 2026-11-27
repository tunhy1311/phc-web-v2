/*
 * PHCReview - rules for completed journeys and reviews (PHC-9 / US11). Owner: Huy.
 * Pure functions: no DOM, no localStorage, no Date.now(). The page scripts (js/review.js,
 * js/my-bookings.js, js/staff-bookings.js) read and save state.bookings with PHCStore.
 *
 *   PHCReview.ERROR                          -> "Rate the journey, the minicab and the driver"
 *   PHCReview.RATED                          -> ["journey", "minicab", "driver"]
 *   PHCReview.isPaidConfirmed(booking)       -> true for a paid, confirmed booking
 *   PHCReview.journeyTaken(booking, now)     -> true when the pick-up time is not after 'now'
 *   PHCReview.canMarkCompleted(booking, now) -> true for a paid, confirmed booking whose pick-up time has passed
 *   PHCReview.markCompleted(booking, now)    -> {ok, booking?, error?}  status "completed", completedAt ISO
 *   PHCReview.isCompleted(booking)           -> true when status is "completed"
 *   PHCReview.canReview(booking)             -> true when completed and not reviewed yet
 *   PHCReview.hasReview(booking)             -> true when a review is saved
 *   PHCReview.validate(input)                -> {ok, error}  input = {journey, minicab, driver, comment}
 *   PHCReview.submitReview(booking, input, now) -> {ok, booking?, error?}  saves booking.review
 *   PHCReview.stars(n)                       -> "★★★★☆" style text for a rating 1..5
 *
 * Saved record (added to the booking, see js/store.js):
 *   status "completed", completedAt ISO,
 *   review { journey 1..5, minicab 1..5, driver 1..5, comment (may be ""), submittedAt ISO }
 */
var PHCReview = (function () {
  "use strict";

  var ERROR = "Rate the journey, the minicab and the driver";
  var RATED = ["journey", "minicab", "driver"];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isoOf(now) {
    var t = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (!isFinite(t)) throw new RangeError("PHCReview: a valid 'now' is required");
    return new Date(t).toISOString();
  }

  function isCompleted(booking) {
    return Boolean(booking) && booking.status === "completed";
  }

  function hasReview(booking) {
    return Boolean(booking) && Boolean(booking.review) && typeof booking.review === "object";
  }

  var NOT_TAKEN = "The journey has not taken place yet. It can be marked as completed after the pick-up time.";

  // Paid and confirmed (not cancelled, not unpaid, not completed yet).
  function isPaidConfirmed(booking) {
    if (!booking) return false;
    return booking.status === "confirmed" && Boolean(booking.payment);
  }

  // The journey has taken place when the pick-up time is not later than 'now'.
  function journeyTaken(booking, now) {
    if (!booking) return false;
    var pickup = new Date(booking.pickupAt).getTime();
    var current = now instanceof Date ? now.getTime() : new Date(now).getTime();
    return isFinite(pickup) && isFinite(current) && pickup <= current;
  }

  // A booking can be marked Completed only when it is paid, confirmed and its pick-up time has passed.
  function canMarkCompleted(booking, now) {
    return isPaidConfirmed(booking) && journeyTaken(booking, now);
  }

  function markCompleted(booking, now) {
    if (!isPaidConfirmed(booking)) {
      return { ok: false, error: "Only a paid, confirmed booking can be marked as completed." };
    }
    if (!journeyTaken(booking, now)) {
      return { ok: false, error: NOT_TAKEN };
    }
    var updated = clone(booking);
    updated.status = "completed";
    updated.completedAt = isoOf(now);
    return { ok: true, booking: updated };
  }

  function canReview(booking) {
    return isCompleted(booking) && !hasReview(booking);
  }

  function isStar(value) {
    var n = Number(value);
    return value !== "" && value != null && Number.isInteger(n) && n >= 1 && n <= 5;
  }

  function validate(input) {
    input = input || {};
    var ok = RATED.every(function (key) { return isStar(input[key]); });
    return ok ? { ok: true, error: "" } : { ok: false, error: ERROR };
  }

  function submitReview(booking, input, now) {
    if (!isCompleted(booking)) {
      return { ok: false, error: "You can review a journey after staff have marked it as completed." };
    }
    if (hasReview(booking)) {
      return { ok: false, error: "You have already reviewed this booking." };
    }
    var check = validate(input);
    if (!check.ok) return { ok: false, error: check.error };
    var updated = clone(booking);
    updated.review = {
      journey: Number(input.journey),
      minicab: Number(input.minicab),
      driver: Number(input.driver),
      comment: typeof input.comment === "string" ? input.comment.trim() : "",
      submittedAt: isoOf(now)
    };
    return { ok: true, booking: updated };
  }

  function stars(n) {
    var count = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return new Array(count + 1).join("★") + new Array(5 - count + 1).join("☆");
  }

  return {
    ERROR: ERROR,
    RATED: RATED,
    NOT_TAKEN: NOT_TAKEN,
    isPaidConfirmed: isPaidConfirmed,
    journeyTaken: journeyTaken,
    canMarkCompleted: canMarkCompleted,
    markCompleted: markCompleted,
    isCompleted: isCompleted,
    canReview: canReview,
    hasReview: hasReview,
    validate: validate,
    submitReview: submitReview,
    stars: stars
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCReview;
}
