/* Unit tests for js/auth.js (PHC-15 / US02). Uses PHCTest from tests/index.html.
   Each test runs on fresh sample data and puts the real stored data back afterwards. */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;

  var T0 = Date.UTC(2026, 11, 1, 9, 0, 0);
  var MIN = 60 * 1000;

  function withFreshStore(fn) {
    var snapshot = PHCStore.all();
    PHCStore.reset();
    try { fn(); } finally {
      Object.keys(snapshot).forEach(function (k) { PHCStore.set(k, snapshot[k]); });
    }
  }

  test("login: valid email and password signs in and sets the session", function () {
    withFreshStore(function () {
      var r = PHCAuth.login("sarah@example.com", "demo1234", T0);
      equal(r.ok, true);
      equal(PHCStore.session().id, "c1");
      equal(PHCAuth.currentCustomer().email, "sarah@example.com");
    });
  });

  test("login: email is case-insensitive and trimmed", function () {
    withFreshStore(function () {
      equal(PHCAuth.login("  SARAH@Example.com ", "demo1234", T0).ok, true);
    });
  });

  test("login: wrong password gives a generic error and no session", function () {
    withFreshStore(function () {
      var r = PHCAuth.login("sarah@example.com", "nope", T0);
      equal(r.ok, false);
      equal(r.locked, false);
      equal(r.error, "Incorrect email or password");
      equal(PHCStore.session(), null);
    });
  });

  test("login: unknown email gives the same generic error", function () {
    withFreshStore(function () {
      equal(PHCAuth.login("nobody@example.com", "demo1234", T0).error, "Incorrect email or password");
    });
  });

  test("login: 2 wrong passwords do not lock, the 3rd does", function () {
    withFreshStore(function () {
      equal(PHCAuth.login("sarah@example.com", "x", T0).locked, false);
      equal(PHCAuth.login("sarah@example.com", "x", T0).locked, false);
      var r = PHCAuth.login("sarah@example.com", "x", T0);
      equal(r.locked, true);
      equal(r.error, "Too many attempts. Reset your password");
    });
  });

  test("login: while locked even the correct password is refused", function () {
    withFreshStore(function () {
      for (var i = 0; i < 3; i++) PHCAuth.login("sarah@example.com", "x", T0);
      equal(PHCAuth.login("sarah@example.com", "demo1234", T0 + 14 * MIN).ok, false);
      equal(PHCStore.session(), null);
    });
  });

  test("login: lock ends after 15 minutes (boundary)", function () {
    withFreshStore(function () {
      for (var i = 0; i < 3; i++) PHCAuth.login("sarah@example.com", "x", T0);
      equal(PHCAuth.lockedUntil("sarah@example.com", T0 + 15 * MIN - 1) > 0, true);
      equal(PHCAuth.login("sarah@example.com", "demo1234", T0 + 15 * MIN).ok, true);
    });
  });

  test("login: a correct login resets the failed-attempt counter", function () {
    withFreshStore(function () {
      PHCAuth.login("sarah@example.com", "x", T0);
      PHCAuth.login("sarah@example.com", "x", T0);
      equal(PHCAuth.login("sarah@example.com", "demo1234", T0).ok, true);
      PHCAuth.logout();
      equal(PHCAuth.login("sarah@example.com", "x", T0).locked, false);
    });
  });

  test("logout: clears the session", function () {
    withFreshStore(function () {
      PHCAuth.login("sarah@example.com", "demo1234", T0);
      PHCAuth.logout();
      equal(PHCStore.session(), null);
      equal(PHCAuth.currentCustomer(), null);
    });
  });

  test("updateProfile: valid data is saved, email stays the same", function () {
    withFreshStore(function () {
      var r = PHCAuth.updateProfile("c1", { name: "Sarah J", phone: "07999 111222", address: "2 Low St", email: "hacker@x.com" });
      equal(r.ok, true);
      var c = PHCStore.get("customers")[0];
      equal(c.name, "Sarah J");
      equal(c.phone, "07999 111222");
      equal(c.email, "sarah@example.com");
    });
  });

  test("updateProfile: invalid phone is rejected and nothing is saved", function () {
    withFreshStore(function () {
      var r = PHCAuth.updateProfile("c1", { name: "Sarah J", phone: "abc", address: "2 Low St" });
      equal(r.ok, false);
      equal(typeof r.errors.phone, "string");
      equal(PHCStore.get("customers")[0].name, "Sarah Jones");
    });
  });

  test("updateProfile: empty name and address are rejected", function () {
    withFreshStore(function () {
      var r = PHCAuth.updateProfile("c1", { name: "  ", phone: "07123 456789", address: "" });
      equal(r.ok, false);
      equal(typeof r.errors.name, "string");
      equal(typeof r.errors.address, "string");
    });
  });
})();
