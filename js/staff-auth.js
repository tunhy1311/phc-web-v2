var PHCStaffAuth = (function () {
  "use strict";

  function norm(email) {
    return String(email || "").trim().toLowerCase();
  }

  function find(predicate) {
    return (PHC_DATA.staff || []).filter(predicate)[0] || null;
  }

  function login(email, password) {
    var key = norm(email);
    var found = find(function (s) { return norm(s.email) === key; });
    if (!found || found.password !== password) {
      return { ok: false, error: "Incorrect email or password" };
    }
    PHCStore.setSession({ role: "staff", id: found.id });
    return { ok: true, staff: { id: found.id, name: found.name, email: found.email } };
  }

  function current() {
    var s = PHCStore.session();
    if (!s || s.role !== "staff") return null;
    var found = find(function (x) { return x.id === s.id; });
    return found ? { id: found.id, name: found.name, email: found.email } : null;
  }

  return { login: login, current: current };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCStaffAuth;
}
