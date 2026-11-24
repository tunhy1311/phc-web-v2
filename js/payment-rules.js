var PHCPayment = (function () {
  "use strict";

  var MESSAGES = {
    name: "Enter the name on the card",
    number: "Card number is not valid",
    expiryMissing: "Enter the expiry date as MM/YY",
    expired: "Card has expired",
    cvv: "Security code must be 3 digits (4 for Amex)",
    declined: "Card declined by bank"
  };

  var TEST_CARDS = {
    approve: ["4242424242424242", "5555555555554444", "378282246310005"],
    decline: ["4000000000000002"]
  };

  function digits(value) {
    return String(value == null ? "" : value).replace(/[\s-]/g, "");
  }

  function cardBrand(number) {
    var n = digits(number);
    if (/^4\d{12}(\d{3}){0,2}$/.test(n)) return "Visa";
    if (/^(5[1-5]\d{2}|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)\d{12}$/.test(n)) return "Mastercard";
    if (/^3[47]\d{13}$/.test(n)) return "Amex";
    return "";
  }

  function parseExpiry(text) {
    var m = /^\s*(\d{2})\s*\/\s*(\d{2})\s*$/.exec(String(text == null ? "" : text));
    if (!m) return null;
    var month = Number(m[1]);
    if (month < 1 || month > 12) return null;
    return { month: month, year: 2000 + Number(m[2]) };
  }

  function isExpired(expiry, now) {
    var d = new Date(now);
    return expiry.year * 12 + expiry.month < d.getFullYear() * 12 + d.getMonth() + 1;
  }

  function validateCard(card, now) {
    var c = card || {};
    var errors = {};
    var number = digits(c.number);
    var brand = cardBrand(number);

    if (!String(c.name == null ? "" : c.name).trim()) errors.name = MESSAGES.name;
    if (!brand || !PHCValidate.luhn(number)) errors.number = MESSAGES.number;

    var expiry = parseExpiry(c.expiry);
    if (!expiry) errors.expiry = MESSAGES.expiryMissing;
    else if (isExpired(expiry, now)) errors.expiry = MESSAGES.expired;

    var cvvLength = brand === "Amex" ? 4 : 3;
    if (!new RegExp("^\\d{" + cvvLength + "}$").test(String(c.cvv == null ? "" : c.cvv).trim())) {
      errors.cvv = MESSAGES.cvv;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      brand: brand,
      last4: number.slice(-4)
    };
  }

  function authorise(number) {
    if (TEST_CARDS.decline.indexOf(digits(number)) !== -1) {
      return { ok: false, error: MESSAGES.declined };
    }
    return { ok: true };
  }

  function canPay(booking, session) {
    if (!booking) return { ok: false, reason: "not-found" };
    if (!session || (session.role !== "customer" && session.role !== "staff")) return { ok: false, reason: "sign-in" };
    if (session.role === "customer" && booking.customerId !== session.id) return { ok: false, reason: "not-found" };
    if (booking.status === "cancelled") return { ok: false, reason: "cancelled" };
    if (booking.status !== "unpaid") return { ok: false, reason: "paid" };
    return { ok: true, reason: "" };
  }

  function markPaid(booking, payment) {
    var next = JSON.parse(JSON.stringify(booking));
    next.status = "confirmed";
    next.payment = {
      method: payment.method,
      brand: payment.brand || "",
      last4: payment.last4 || "",
      paidAt: payment.paidAt,
      reference: payment.reference
    };
    return next;
  }

  function newReference() {
    return "PAY-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  return {
    MESSAGES: MESSAGES,
    TEST_CARDS: TEST_CARDS,
    cardBrand: cardBrand,
    validateCard: validateCard,
    authorise: authorise,
    canPay: canPay,
    markPaid: markPaid,
    newReference: newReference
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCPayment;
}
