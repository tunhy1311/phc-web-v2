/*
 * PHCValidate - input validators. Each returns true or false, never throws.
 *   PHCValidate.email(s)
 *   PHCValidate.phone(s)     UK: 11 digits starting with 0 (07123 456789) or +44 form (+44 7123 456789)
 *   PHCValidate.postcode(s)  UK postcode, space optional (E1 6AN, SW1A 1AA)
 *   PHCValidate.luhn(n)      card number, spaces/dashes allowed, 12-19 digits
 */
var PHCValidate = (function () {
  "use strict";

  function asText(s) {
    return typeof s === "string" ? s.trim() : "";
  }

  function email(s) {
    var v = asText(s);
    return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function phone(s) {
    var v = asText(s).replace(/[\s\-()]/g, "");
    return /^0\d{10}$/.test(v) || /^\+44[1-9]\d{9}$/.test(v);
  }

  function postcode(s) {
    var v = asText(s).toUpperCase();
    return /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(v);
  }

  function luhn(cardNumber) {
    var v = (typeof cardNumber === "number" ? String(cardNumber) : asText(cardNumber)).replace(/[\s-]/g, "");
    if (!/^\d{12,19}$/.test(v)) return false;
    var sum = 0;
    var double = false;
    for (var i = v.length - 1; i >= 0; i--) {
      var d = v.charCodeAt(i) - 48;
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    return sum % 10 === 0;
  }

  return { email: email, phone: phone, postcode: postcode, luhn: luhn };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCValidate;
}
