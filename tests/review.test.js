/* Unit tests for js/review-rules.js (PHC-9 / US11). Uses PHCTest from tests/index.html. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;

  var NOW = "2026-12-06T10:00:00Z";

  function booking(extra) {
    var b = {
      id: "bk12ab", customerId: "c1", serviceName: "Airport transfer", pickupAt: "2026-12-05T14:30:00",
      total: 38.25, status: "confirmed",
      payment: { method: "card", brand: "Visa", last4: "4242", paidAt: "2026-11-25T10:00:00Z", reference: "PAY-ABC123", amount: 38.25 }
    };
    for (var k in extra) b[k] = extra[k];
    return b;
  }

  function completed(extra) {
    return booking(Object.assign({ status: "completed", completedAt: NOW }, extra || {}));
  }

  var GOOD = { journey: 5, minicab: 4, driver: 5, comment: "  Lovely driver  " };

  test("review: staff can mark a paid confirmed booking as completed", function () {
    var r = PHCReview.markCompleted(booking(), NOW);
    equal(r.ok, true);
    equal(r.booking.status, "completed");
    equal(r.booking.completedAt, "2026-12-06T10:00:00.000Z");
  });

  test("review: marking as completed does not change the original booking", function () {
    var b = booking();
    PHCReview.markCompleted(b, NOW);
    equal(b.status, "confirmed");
  });

  test("review: unpaid, cancelled and already completed bookings cannot be marked completed", function () {
    equal(PHCReview.canMarkCompleted(booking({ status: "unpaid", payment: null })), false);
    equal(PHCReview.canMarkCompleted(booking({ status: "cancelled" })), false);
    equal(PHCReview.canMarkCompleted(completed()), false);
    equal(PHCReview.canMarkCompleted(null), false);
    equal(PHCReview.markCompleted(booking({ status: "cancelled" }), NOW).ok, false);
  });

  test("review: the review option is shown only for a completed booking without a review", function () {
    equal(PHCReview.canReview(completed()), true);
  });

  test("review: the review option is not shown when Unpaid, Confirmed or Cancelled", function () {
    equal(PHCReview.canReview(booking({ status: "unpaid", payment: null })), false);
    equal(PHCReview.canReview(booking()), false);
    equal(PHCReview.canReview(booking({ status: "cancelled" })), false);
    equal(PHCReview.canReview(null), false);
  });

  test("review: all three ratings from 1 to 5 are accepted", function () {
    equal(PHCReview.validate({ journey: 1, minicab: 3, driver: 5 }).ok, true);
    equal(PHCReview.validate({ journey: "2", minicab: "4", driver: "5" }).ok, true);
  });

  test("review: a missing rating gives the required message", function () {
    ["journey", "minicab", "driver"].forEach(function (missing) {
      var input = { journey: 5, minicab: 5, driver: 5 };
      delete input[missing];
      var r = PHCReview.validate(input);
      equal(r.ok, false);
      equal(r.error, "Rate the journey, the minicab and the driver");
    });
  });

  test("review: empty, zero, six and fractional ratings are refused", function () {
    equal(PHCReview.validate({ journey: "", minicab: 5, driver: 5 }).ok, false);
    equal(PHCReview.validate({ journey: 0, minicab: 5, driver: 5 }).ok, false);
    equal(PHCReview.validate({ journey: 6, minicab: 5, driver: 5 }).ok, false);
    equal(PHCReview.validate({ journey: 2.5, minicab: 5, driver: 5 }).ok, false);
    equal(PHCReview.validate(null).ok, false);
  });

  test("review: submitting saves the three ratings and the trimmed comment", function () {
    var r = PHCReview.submitReview(completed(), GOOD, NOW);
    equal(r.ok, true);
    equal(r.booking.review.journey, 5);
    equal(r.booking.review.minicab, 4);
    equal(r.booking.review.driver, 5);
    equal(r.booking.review.comment, "Lovely driver");
    equal(r.booking.review.submittedAt, "2026-12-06T10:00:00.000Z");
  });

  test("review: the comment is optional", function () {
    var r = PHCReview.submitReview(completed(), { journey: 3, minicab: 3, driver: 3 }, NOW);
    equal(r.ok, true);
    equal(r.booking.review.comment, "");
  });

  test("review: a missing rating saves nothing", function () {
    var b = completed();
    var r = PHCReview.submitReview(b, { journey: 5, minicab: 5, comment: "x" }, NOW);
    equal(r.ok, false);
    equal(r.error, "Rate the journey, the minicab and the driver");
    equal(PHCReview.hasReview(b), false);
  });

  test("review: a booking cannot be reviewed twice", function () {
    var once = PHCReview.submitReview(completed(), GOOD, NOW).booking;
    equal(PHCReview.canReview(once), false);
    var again = PHCReview.submitReview(once, { journey: 1, minicab: 1, driver: 1 }, NOW);
    equal(again.ok, false);
    equal(again.error, "You have already reviewed this booking.");
    equal(once.review.journey, 5);
  });

  test("review: a booking that is not completed cannot be reviewed", function () {
    equal(PHCReview.submitReview(booking(), GOOD, NOW).ok, false);
    equal(PHCReview.submitReview(booking({ status: "cancelled" }), GOOD, NOW).ok, false);
  });

  test("review: stars shows the rating out of five", function () {
    equal(PHCReview.stars(4), "★★★★☆");
    equal(PHCReview.stars(5), "★★★★★");
    equal(PHCReview.stars(1), "★☆☆☆☆");
  });

  test("review: a completed booking cannot be cancelled or amended", function () {
    equal(PHCRules.canChangeBooking(completed({ pickupAt: "2099-01-01T10:00:00" }), "2026-12-01T10:00:00"), false);
  });
})();
