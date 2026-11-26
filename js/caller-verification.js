/* Pure business rules for the US12 staff caller-verification flow. */
var PHCCallerVerification = (function () {
  "use strict";

  function normalPhone(value) {
    var phone = String(value || "").trim().replace(/[\s\-()]/g, "");

    // Store and compare UK numbers in domestic form so that 07123... and
    // +447123... identify the same customer account.
    if (/^\+44[1-9]\d{9}$/.test(phone)) return "0" + phone.slice(3);
    return phone;
  }

  function findCustomer(customers, bookings, type, query) {
    var list = Array.isArray(customers) ? customers : [];
    var bookingList = Array.isArray(bookings) ? bookings : [];
    var wanted = String(query || "").trim();

    if (type === "phone") {
      var phone = normalPhone(wanted);
      return list.filter(function (customer) {
        return normalPhone(customer.phone) === phone;
      })[0] || null;
    }

    if (type === "email") {
      var email = wanted.toLowerCase();
      return list.filter(function (customer) {
        return String(customer.email || "").toLowerCase() === email;
      })[0] || null;
    }

    if (type !== "booking") return null;

    var reference = wanted.toLowerCase();
    var booking = bookingList.filter(function (item) {
      return [item.id, item.reference, item.bookingReference].some(function (value) {
        return String(value || "").toLowerCase() === reference;
      });
    })[0];

    if (!booking) return null;
    return list.filter(function (customer) {
      return customer.id === booking.customerId;
    })[0] || null;
  }

  function verifyCustomer(customer, postcode, dob) {
    if (!customer) return false;
    var enteredPostcode = String(postcode || "").toUpperCase().replace(/\s/g, "");
    var savedPostcode = String(customer.postcode || "").toUpperCase().replace(/\s/g, "");
    var enteredDob = String(dob || "").trim();
    var savedDob = String(customer.dob || "").trim();

    // Missing answers must never compare equal and unlock an account.
    if (!enteredPostcode || !savedPostcode || !enteredDob || !savedDob) return false;
    return enteredPostcode === savedPostcode &&
      enteredDob === savedDob;
  }

  function isStaffSession(session) {
    return !!(session && session.role === "staff" && String(session.id || "").trim());
  }

  function createCustomer(existingCustomers, details, id) {
    var list = Array.isArray(existingCustomers) ? existingCustomers : [];
    var values = details || {};
    var name = String(values.name || "").trim();
    var email = String(values.email || "").trim().toLowerCase();
    var phone = String(values.phone || "").trim();
    var postcode = String(values.postcode || "").trim().toUpperCase();
    var dob = String(values.dob || "");

    if (!name) return { valid: false, error: "Enter the customer's name." };
    if (!PHCValidate.email(email)) return { valid: false, error: "Enter a valid email address." };
    if (!PHCValidate.phone(phone)) return { valid: false, error: "Enter a valid UK phone number." };
    if (!PHCValidate.postcode(postcode)) return { valid: false, error: "Enter a valid UK postcode." };
    if (!dob) return { valid: false, error: "Enter the customer's date of birth." };
    if (list.some(function (customer) {
      return String(customer.email || "").toLowerCase() === email;
    })) {
      return { valid: false, error: "An account with this email already exists." };
    }

    return {
      valid: true,
      error: "",
      customer: {
        id: id,
        name: name,
        email: email,
        phone: phone,
        address: "",
        postcode: postcode,
        dob: dob,
        password: "",
        card: null,
        bookings: []
      }
    };
  }

  return {
    normalPhone: normalPhone,
    findCustomer: findCustomer,
    verifyCustomer: verifyCustomer,
    isStaffSession: isStaffSession,
    createCustomer: createCustomer
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCCallerVerification;
}
