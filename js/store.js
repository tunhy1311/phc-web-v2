/*
 * PHCStore - the only place that reads/writes localStorage.
 * All app state lives in ONE key: "phc-state-v1" (a JSON object).
 *
 * State keys (contract, do not rename):
 *   customers, session, cars, drivers, bookings, draftBooking, loginAttempts
 *
 * API:
 *   PHCStore.get(key)            -> deep copy of state[key]
 *   PHCStore.set(key, value)     -> saves state[key] = value
 *   PHCStore.update(key, fn)     -> fn(oldCopy) must return the new value, which is saved
 *   PHCStore.session()           -> null or {role, id}
 *   PHCStore.setSession(objOrNull)
 *   PHCStore.reset()             -> back to PHC_DATA sample data
 *   PHCStore.all()               -> deep copy of the whole state (debugging)
 *
 * Requires js/data.js to be loaded first.
 */
var PHCStore = (function () {
  "use strict";

  var KEY = "phc-state-v1";
  var memoryFallback = null; // used only if localStorage is unavailable

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seed() {
    return {
      customers: clone(PHC_DATA.customers),
      session: null,
      cars: clone(PHC_DATA.cars),
      drivers: clone(PHC_DATA.drivers),
      bookings: clone(PHC_DATA.bookings || []),
      draftBooking: null,
      loginAttempts: {}
    };
  }

  function readRaw() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (e) {
      return memoryFallback;
    }
  }

  function writeRaw(text) {
    try {
      window.localStorage.setItem(KEY, text);
    } catch (e) {
      memoryFallback = text;
    }
  }

  function load() {
    var raw = readRaw();
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Corrupted JSON: fall through and re-seed.
      }
    }
    var fresh = seed();
    save(fresh);
    return fresh;
  }

  function save(state) {
    writeRaw(JSON.stringify(state));
  }

  function get(key) {
    return clone(load()[key]);
  }

  function set(key, value) {
    var state = load();
    state[key] = clone(value);
    save(state);
    return clone(state[key]);
  }

  function update(key, fn) {
    if (typeof fn !== "function") {
      throw new TypeError("PHCStore.update(key, fn): fn must be a function");
    }
    var state = load();
    var draft = clone(state[key]);
    var next = fn(draft);
    // Convenience: if fn mutates the copy and returns nothing, keep the mutated copy.
    state[key] = clone(next === undefined ? draft : next);
    save(state);
    return clone(state[key]);
  }

  function session() {
    return get("session") || null;
  }

  function setSession(obj) {
    if (obj !== null) {
      if (!obj || (obj.role !== "customer" && obj.role !== "staff") || !obj.id) {
        throw new TypeError('setSession expects null or {role:"customer"|"staff", id}');
      }
      obj = { role: obj.role, id: String(obj.id) };
    }
    return set("session", obj);
  }

  function reset() {
    var fresh = seed();
    save(fresh);
    return clone(fresh);
  }

  function all() {
    return clone(load());
  }

  // First run: make sure the key exists with sample data.
  load();

  return {
    KEY: KEY,
    get: get,
    set: set,
    update: update,
    session: session,
    setSession: setSession,
    reset: reset,
    all: all
  };
})();
