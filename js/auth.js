/*
 * PHCAuth - customer sign-in helper (PHC-15 / US02). Owner: Huy.
 * Uses PHCStore (state keys: customers, session, loginAttempts) and PHCValidate.phone.
 * Load order: data.js, store.js, ui.js, validators.js, auth.js.
 *
 *   PHCAuth.login(email, password[, nowMs])  -> {ok, customer} | {ok:false, locked, error}
 *        3 wrong passwords in a row lock that email for 15 minutes.
 *   PHCAuth.currentCustomer()                -> customer object or null
 *   PHCAuth.requireCustomer(nextUrl)         -> customer, or redirects to login.html?next=... and returns null
 *   PHCAuth.logout()                         -> clears the session (call PHCUI.renderHeader() afterwards)
 *   PHCAuth.updateProfile(id, {name, phone, address}) -> {ok} | {ok:false, errors:{field:message}}
 *        The email address is never changed.
 *   PHCAuth.lockedUntil(email[, nowMs])      -> ms timestamp, or 0 when not locked
 *   PHCAuth.MAX_TRIES, PHCAuth.LOCK_MS
 *
 * Prototype only: passwords are plain text in sample data. Never do this in a real system.
 */
var PHCAuth = (function () {
  "use strict";

  var MAX_TRIES = 3;
  var LOCK_MS = 15 * 60 * 1000;

  function norm(email) {
    return String(email || "").trim().toLowerCase();
  }

  function customers() {
    return PHCStore.get("customers") || [];
  }

  function attempts() {
    return PHCStore.get("loginAttempts") || {};
  }

  function lockedUntil(email, now) {
    now = now == null ? Date.now() : now;
    var rec = attempts()[norm(email)];
    return rec && rec.lockedUntil > now ? rec.lockedUntil : 0;
  }

  function login(email, password, now) {
    now = now == null ? Date.now() : now;
    var key = norm(email);
    var all = attempts();
    var rec = all[key] || { count: 0, lockedUntil: 0 };
    var lockedMessage = "Too many attempts. Reset your password";

    if (rec.lockedUntil > now) return { ok: false, locked: true, error: lockedMessage };

    var found = customers().filter(function (c) { return norm(c.email) === key; })[0];
    if (found && found.password === password) {
      delete all[key];
      PHCStore.set("loginAttempts", all);
      PHCStore.setSession({ role: "customer", id: found.id });
      return { ok: true, customer: found };
    }

    rec.count += 1;
    if (rec.count >= MAX_TRIES) {
      all[key] = { count: 0, lockedUntil: now + LOCK_MS };
      PHCStore.set("loginAttempts", all);
      return { ok: false, locked: true, error: lockedMessage };
    }
    all[key] = rec;
    PHCStore.set("loginAttempts", all);
    return { ok: false, locked: false, error: "Incorrect email or password" };
  }

  function currentCustomer() {
    var s = PHCStore.session();
    if (!s || s.role !== "customer") return null;
    return customers().filter(function (c) { return c.id === s.id; })[0] || null;
  }

  function requireCustomer(nextUrl) {
    var c = currentCustomer();
    if (c) return c;
    window.location.href = "login.html?next=" + encodeURIComponent(nextUrl || "my-bookings.html");
    return null;
  }

  function logout() {
    PHCStore.setSession(null);
  }

  function updateProfile(id, data) {
    var errors = {};
    var name = String((data && data.name) || "").trim();
    var phone = String((data && data.phone) || "").trim();
    var address = String((data && data.address) || "").trim();
    if (!name) errors.name = "Please enter your name";
    if (!address) errors.address = "Please enter your address";
    if (!PHCValidate.phone(phone)) errors.phone = "Enter a valid UK phone number, e.g. 07123 456789";
    if (Object.keys(errors).length) return { ok: false, errors: errors };

    var done = false;
    PHCStore.update("customers", function (list) {
      list.forEach(function (c) {
        if (c.id === id) {
          c.name = name; c.phone = phone; c.address = address; // c.email stays as it is
          done = true;
        }
      });
      return list;
    });
    return done ? { ok: true } : { ok: false, errors: { form: "Account not found" } };
  }

  return {
    MAX_TRIES: MAX_TRIES,
    LOCK_MS: LOCK_MS,
    login: login,
    lockedUntil: lockedUntil,
    currentCustomer: currentCustomer,
    requireCustomer: requireCustomer,
    logout: logout,
    updateProfile: updateProfile
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCAuth;
}
