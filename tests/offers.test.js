/* Unit tests for js/offers.js (PHC-17 / US18). Uses PHCTest from tests/index.html. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;
  var NOW = "2026-11-26T10:00:00.000Z";

  function confirmed(customerId, number) {
    var list = [];
    for (var i = 0; i < number; i++) {
      list.push({ id: "b" + i, customerId: customerId, status: "confirmed" });
    }
    return list;
  }

  function issuedOffer() {
    return PHCOffers.issue("c1", confirmed("c1", 5), [], NOW).offer;
  }

  test("offers: five confirmed bookings are required", function () {
    equal(PHCOffers.isEligible(confirmed("c1", 4), "c1"), false);
    equal(PHCOffers.isEligible(confirmed("c1", 5), "c1"), true);
  });

  test("offers: cancelled and another customer's bookings do not count", function () {
    var bookings = confirmed("c1", 4).concat([
      { customerId: "c1", status: "cancelled" },
      { customerId: "c2", status: "confirmed" }
    ]);
    equal(PHCOffers.confirmedCount(bookings, "c1"), 4);
  });

  test("offers: an eligible customer receives one 10% code valid for 30 days", function () {
    var result = PHCOffers.issue("c1", confirmed("c1", 5), [], NOW);
    equal(result.issued, true);
    equal(result.offer.percent, 0.10);
    equal(result.offer.used, false);
    equal(result.offer.expiresAt, "2026-12-26T10:00:00.000Z");
    equal(result.offers.length, 1);
  });

  test("offers: reopening the page reuses the existing code", function () {
    var first = PHCOffers.issue("c1", confirmed("c1", 5), [], NOW);
    var second = PHCOffers.issue("c1", confirmed("c1", 5), first.offers, "2026-11-27T10:00:00.000Z");
    equal(second.issued, false);
    equal(second.offer.code, first.offer.code);
    equal(second.offers.length, 1);
  });

  test("offers: a valid code is accepted without case sensitivity", function () {
    var offer = issuedOffer();
    equal(PHCOffers.validate(offer.code.toLowerCase(), "c1", [offer], NOW).ok, true);
  });

  test("offers: unknown, expired and wrong-customer codes use the invalid message", function () {
    var offer = issuedOffer();
    equal(PHCOffers.validate("wrong", "c1", [offer], NOW).message, "This code is not valid");
    equal(PHCOffers.validate(offer.code, "c2", [offer], NOW).message, "This code is not valid");
    equal(PHCOffers.validate(offer.code, "c1", [offer], offer.expiresAt).message, "This code is not valid");
  });

  test("offers: a used code has the required message", function () {
    var offer = issuedOffer();
    offer.used = true;
    equal(PHCOffers.validate(offer.code, "c1", [offer], NOW).message, "This code has already been used");
  });

  test("offers: 10% is applied after the 15% online discount", function () {
    var booking = { id: "b1", total: 85 };
    var discounted = PHCOffers.applyToBooking(booking, issuedOffer());
    equal(discounted.totalBeforeOffer, 85);
    equal(discounted.offerDiscount, 8.5);
    equal(discounted.total, 76.5);
    equal(booking.total, 85);
  });

  test("offers: applying the same offer again does not double-discount", function () {
    var offer = issuedOffer();
    var once = PHCOffers.applyToBooking({ id: "b1", total: 38.25 }, offer);
    var twice = PHCOffers.applyToBooking(once, offer);
    equal(twice.offerDiscount, 3.83);
    equal(twice.total, 34.42);
  });

  test("offers: consuming a code marks only the returned copy as used", function () {
    var offer = issuedOffer();
    var list = PHCOffers.consume([offer], offer.code, "b1", NOW);
    equal(list[0].used, true);
    equal(list[0].bookingId, "b1");
    equal(offer.used, false);
  });
})();
