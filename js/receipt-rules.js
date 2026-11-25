/*
 * PHCReceipt - rules for the online receipt (PHC-24 / US09). Owner: Huy.
 * Pure functions: no DOM, no storage. Unit tested in tests/receipt.test.js.
 * Load order: data.js, store.js, ui.js (only for pages), then this file.
 *
 *   PHCReceipt.canView(booking, session)  -> {ok, reason}
 *        reason: "not-found" | "sign-in" | "cancelled" | "unpaid" | ""
 *        A receipt exists only for a paid booking (booking.payment saved by the payment page, US08).
 *   PHCReceipt.build(booking)             -> receipt model for the page (reference, journey, price lines, payment)
 *        total = the amount recorded at payment (payment.amount); if the booking was amended after
 *        payment, amended = true, the fare lines are left out and currentTotal holds the new booking total.
 *   PHCReceipt.reasonText(reason)         -> sentence for the customer
 *   PHCReceipt.referenceOf(booking)       -> booking reference shown at the top of the receipt
 *
 * Offer code lines are not included: they are added in Sprint 3 (see PHC-24).
 */
var PHCReceipt = (function () {
  "use strict";

  var REASONS = {
    "not-found": "We could not find that booking in your account.",
    "sign-in": "Sign in to see your receipt.",
    cancelled: "This booking was cancelled, so there is no receipt.",
    unpaid: "This booking is not paid yet. Your receipt is available after payment."
  };

  function reasonText(reason) {
    return REASONS[reason] || "";
  }

  function referenceOf(booking) {
    return "PHC-" + String((booking && booking.id) || "").toUpperCase();
  }

  function canView(booking, session) {
    if (!booking) return { ok: false, reason: "not-found" };
    if (!session || session.role !== "customer") return { ok: false, reason: "sign-in" };
    if (booking.customerId !== session.id) return { ok: false, reason: "not-found" };
    if (booking.status === "cancelled") return { ok: false, reason: "cancelled" };
    if (booking.status === "unpaid" || !booking.payment) return { ok: false, reason: "unpaid" };
    return { ok: true, reason: "" };
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function paymentLabel(payment) {
    var p = payment || {};
    if (p.method === "paypal") return "PayPal";
    if (p.last4) return (p.brand || "Card") + " ending " + p.last4;
    return "Paid";
  }

  function build(booking) {
    var pickup = new Date(booking.pickupAt);
    var base = Number(booking.baseFare);
    var discount = Number(booking.discount) || 0;
    var total = Number(booking.total);
    var paidAmount = booking.payment && typeof booking.payment.amount === "number" ? booking.payment.amount : null;
    // A booking can be amended after payment (US10). The receipt always shows what was actually paid.
    var amended = paidAmount !== null && Math.round(paidAmount * 100) !== Math.round(total * 100);
    var lines = [];
    if (!amended) {
      lines.push({ label: booking.serviceName + " fare", amount: base });
      if (discount > 0) lines.push({ label: "Online booking discount", amount: -discount });
    }

    return {
      reference: referenceOf(booking),
      paidAt: booking.payment ? booking.payment.paidAt : "",
      paymentReference: booking.payment ? booking.payment.reference : "",
      paymentMethod: paymentLabel(booking.payment),
      serviceName: booking.serviceName,
      pickup: booking.pickup,
      destination: booking.destination,
      date: pickup.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      time: pad2(pickup.getHours()) + ":" + pad2(pickup.getMinutes()),
      carSize: Number(booking.carSize),
      passengers: Number(booking.passengers),
      flight: booking.flight || "",
      hours: booking.hours || null,
      lines: lines,
      total: paidAmount !== null ? paidAmount : total,
      amended: amended,
      currentTotal: total
    };
  }

  return {
    canView: canView,
    build: build,
    reasonText: reasonText,
    referenceOf: referenceOf
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCReceipt;
}
