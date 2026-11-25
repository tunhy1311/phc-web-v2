/* Unit tests for US12 caller search, security verification and customer creation. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;

  var customers = [
    {
      id: "c1",
      name: "Sarah Jones",
      email: "sarah@example.com",
      phone: "07111 222333",
      postcode: "E1 6AN",
      dob: "1990-04-15"
    }
  ];
  var bookings = [
    { id: "b-1001", reference: "PHC-ABC", customerId: "c1" }
  ];

  test("caller search: finds a customer by phone, email and booking reference", function () {
    equal(PHCCallerVerification.findCustomer(customers, bookings, "phone", "07111222333").id, "c1");
    equal(PHCCallerVerification.findCustomer(customers, bookings, "email", " SARAH@EXAMPLE.COM ").id, "c1");
    equal(PHCCallerVerification.findCustomer(customers, bookings, "booking", "phc-abc").id, "c1");
  });

  test("caller verification: both correct security answers unlock the account", function () {
    equal(PHCCallerVerification.verifyCustomer(customers[0], "e1 6an", "1990-04-15"), true);
  });

  test("caller verification: one incorrect answer returns Verification failed", function () {
    equal(PHCCallerVerification.verifyCustomer(customers[0], "E1 6AN", "1991-04-15"), false);
    equal(PHCCallerVerification.verifyCustomer(customers[0], "SW1A 1AA", "1990-04-15"), false);
  });

  test("new customer: valid details create a normalized customer record", function () {
    var result = PHCCallerVerification.createCustomer(customers, {
      name: "  Alex Smith  ",
      email: " ALEX@EXAMPLE.COM ",
      phone: "07222 333444",
      postcode: "sw1a 1aa",
      dob: "1988-08-20"
    }, "c2");

    equal(result.valid, true);
    equal(result.customer.id, "c2");
    equal(result.customer.name, "Alex Smith");
    equal(result.customer.email, "alex@example.com");
    equal(result.customer.postcode, "SW1A 1AA");
  });

  test("new customer: duplicate email is rejected without creating an account", function () {
    var result = PHCCallerVerification.createCustomer(customers, {
      name: "Another Sarah",
      email: "SARAH@example.com",
      phone: "07222 333444",
      postcode: "SW1A 1AA",
      dob: "1988-08-20"
    }, "c2");

    equal(result.valid, false);
    equal(result.customer, undefined);
    equal(result.error, "An account with this email already exists.");
  });
})();
