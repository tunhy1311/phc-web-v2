var PHCStaffBooking = (function () {
  "use strict";

  var CHANNELS = { phone: "Phone", "in-person": "In person" };

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function phoneDigits(value) {
    var v = String(value == null ? "" : value).replace(/[^\d+]/g, "");
    if (v.indexOf("+44") === 0) v = "0" + v.slice(3);
    return v.replace(/\D/g, "");
  }

  function findCustomers(customers, query) {
    var q = text(query);
    var list = customers || [];
    if (!q) return [];
    if (q.indexOf("@") !== -1) {
      var email = q.toLowerCase();
      return list.filter(function (c) { return text(c.email).toLowerCase() === email; });
    }
    var phone = phoneDigits(q);
    if (phone.length < 10) return [];
    return list.filter(function (c) { return phoneDigits(c.phone) === phone; });
  }

  function validateNewCustomer(data, customers) {
    var d = data || {};
    var errors = {};
    var name = text(d.name);
    if (name.length < 2) errors.name = "Enter the customer's full name";
    if (!PHCValidate.email(d.email)) errors.email = "Enter a valid email address";
    else if (findCustomers(customers, d.email).length) errors.email = "A customer with this email already exists";
    if (!PHCValidate.phone(d.phone)) errors.phone = "Enter a UK phone number, e.g. 07123 456789";
    else if (findCustomers(customers, d.phone).length) errors.phone = "A customer with this phone number already exists";
    if (!text(d.address)) errors.address = "Enter the address";
    if (!PHCValidate.postcode(d.postcode)) errors.postcode = "Enter a valid UK postcode, e.g. E1 6AN";
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  function buildCustomer(data, id) {
    return {
      id: id,
      name: text(data.name),
      email: text(data.email).toLowerCase(),
      phone: text(data.phone),
      address: text(data.address),
      postcode: text(data.postcode).toUpperCase(),
      dob: "",
      password: "",
      card: null,
      bookings: [],
      createdBy: "staff"
    };
  }

  function validateStaffBooking(details, service, now) {
    var d = details || {};
    var result = PHCRules.validateBooking({
      pickup: d.pickup,
      destination: d.destination,
      date: d.date,
      time: d.time,
      passengers: d.passengers,
      carSize: d.carSize,
      byTime: !!(service && service.byTime),
      hours: d.hours
    }, now);
    if (!service) result.errors.service = "Choose a service";
    if (!CHANNELS[d.channel]) result.errors.channel = "Choose phone or in person";
    var flight = text(d.flight).toUpperCase();
    if (service && service.needsFlight && flight && !/^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/.test(flight)) {
      result.errors.flight = "Enter a flight number like BA117";
    }
    result.valid = Object.keys(result.errors).length === 0;
    return result;
  }

  function price(service, hours, channel) {
    var base = PHCRules.baseFare(service, service.byTime ? { hours: Number(hours) } : undefined);
    var total = channel === "online" ? PHCRules.applyOnlineDiscount(base) : base;
    return { base: base, discount: Math.round((base - total) * 100) / 100, total: total };
  }

  function buildBooking(o) {
    var d = o.details;
    var p = price(o.service, d.hours, o.channel);
    return {
      id: o.id,
      customerId: o.customer.id,
      serviceId: o.service.id,
      serviceName: o.service.name,
      flight: o.service.needsFlight ? text(d.flight).toUpperCase() : "",
      hours: o.service.byTime ? Number(d.hours) : null,
      pickup: text(d.pickup),
      destination: text(d.destination),
      pickupAt: o.pickupAt,
      passengers: Number(d.passengers),
      carSize: Number(d.carSize),
      baseFare: p.base,
      discount: p.discount,
      total: p.total,
      channel: o.channel,
      tag: PHCRules.bookingTag(o.channel),
      status: "unpaid",
      createdBy: o.staffId,
      createdAt: o.createdAt
    };
  }

  return {
    CHANNELS: CHANNELS,
    findCustomers: findCustomers,
    validateNewCustomer: validateNewCustomer,
    buildCustomer: buildCustomer,
    validateStaffBooking: validateStaffBooking,
    price: price,
    buildBooking: buildBooking
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCStaffBooking;
}
