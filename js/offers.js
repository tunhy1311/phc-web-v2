/*
 * PHCOffers - loyalty offer rules for PHC-17 / US18.
 * Pure functions: no DOM or storage. Load before pages that issue, apply or consume offers.
 */
var PHCOffers = (function () {
  "use strict";

  var PERCENT = 0.10;
  var REQUIRED_CONFIRMED_BOOKINGS = 5;
  var VALID_DAYS = 30;
  var INVALID_MESSAGE = "This code is not valid";
  var USED_MESSAGE = "This code has already been used";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function normaliseCode(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function confirmedCount(bookings, customerId) {
    return (bookings || []).filter(function (booking) {
      return booking.customerId === customerId && booking.status === "confirmed";
    }).length;
  }

  function isEligible(bookings, customerId) {
    return confirmedCount(bookings, customerId) >= REQUIRED_CONFIRMED_BOOKINGS;
  }

  function codeFor(customerId, issuedAt, offers) {
    var stem = "PHC10-" + String(customerId).replace(/[^a-z0-9]/gi, "").toUpperCase() +
      "-" + issuedAt.getTime().toString(36).toUpperCase();
    var code = stem;
    var suffix = 2;
    while ((offers || []).some(function (offer) { return normaliseCode(offer.code) === code; })) {
      code = stem + "-" + suffix;
      suffix++;
    }
    return code;
  }

  function issue(customerId, bookings, offers, now) {
    var list = clone(offers || []);
    if (!isEligible(bookings, customerId)) return { issued: false, offer: null, offers: list };

    var existing = list.filter(function (offer) { return offer.customerId === customerId; })[0] || null;
    if (existing) return { issued: false, offer: clone(existing), offers: list };

    var issuedAt = new Date(now);
    var expiresAt = new Date(issuedAt.getTime());
    expiresAt.setDate(expiresAt.getDate() + VALID_DAYS);
    var offer = {
      code: codeFor(customerId, issuedAt, list),
      customerId: customerId,
      percent: PERCENT,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
      usedAt: "",
      bookingId: ""
    };
    list.push(offer);
    return { issued: true, offer: clone(offer), offers: list };
  }

  function validate(code, customerId, offers, now) {
    var wanted = normaliseCode(code);
    var offer = (offers || []).filter(function (item) {
      return normaliseCode(item.code) === wanted && item.customerId === customerId;
    })[0] || null;
    if (!offer) return { ok: false, reason: "invalid", message: INVALID_MESSAGE, offer: null };
    if (offer.used) return { ok: false, reason: "used", message: USED_MESSAGE, offer: clone(offer) };
    if (new Date(now).getTime() >= new Date(offer.expiresAt).getTime()) {
      return { ok: false, reason: "invalid", message: INVALID_MESSAGE, offer: clone(offer) };
    }
    return { ok: true, reason: "", message: "", offer: clone(offer) };
  }

  function removeFromBooking(booking) {
    var next = clone(booking);
    if (next.offerCode) {
      next.total = Number(next.totalBeforeOffer);
      delete next.offerCode;
      delete next.offerDiscount;
      delete next.totalBeforeOffer;
    }
    return next;
  }

  function applyToBooking(booking, offer) {
    var next = removeFromBooking(booking);
    var before = Number(next.total);
    var discount = roundMoney(before * Number(offer.percent || PERCENT));
    next.totalBeforeOffer = before;
    next.offerCode = normaliseCode(offer.code);
    next.offerDiscount = discount;
    next.total = roundMoney(before - discount);
    return next;
  }

  function consume(offers, code, bookingId, now) {
    var wanted = normaliseCode(code);
    return clone(offers || []).map(function (offer) {
      if (normaliseCode(offer.code) !== wanted) return offer;
      offer.used = true;
      offer.usedAt = new Date(now).toISOString();
      offer.bookingId = bookingId;
      return offer;
    });
  }

  return {
    PERCENT: PERCENT,
    REQUIRED_CONFIRMED_BOOKINGS: REQUIRED_CONFIRMED_BOOKINGS,
    VALID_DAYS: VALID_DAYS,
    INVALID_MESSAGE: INVALID_MESSAGE,
    USED_MESSAGE: USED_MESSAGE,
    confirmedCount: confirmedCount,
    isEligible: isEligible,
    issue: issue,
    validate: validate,
    applyToBooking: applyToBooking,
    removeFromBooking: removeFromBooking,
    consume: consume
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCOffers;
}
