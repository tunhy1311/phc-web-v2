/*
 * PHCService - booking step 1: choose a service (PHC-19 / US04). Owner: Huy.
 * Fills <section id="step-service"> on customer/book.html from PHC_DATA.services.
 *
 * Writes to draftBooking (other keys in draftBooking are kept):
 *   { service: "<id>", flight: "BA123" (only for needsFlight services), hours: 4 (only for byTime services) }
 *
 * When the customer presses Continue and everything is valid, this script
 *   1. saves draftBooking,
 *   2. hides #step-service and shows #step-details,
 *   3. dispatches document event "phc:service-chosen" (detail = the saved draftBooking).
 * Phuc.N's step 2 can listen for that event, and can go back with PHCService.open().
 *
 * PHCService.validate(services, {service, flight, hours}) is pure (used by the unit tests):
 *   -> {ok, errors:{service|flight|hours: message}, service}
 */
var PHCService = (function () {
  "use strict";

  var FLIGHT_RE = /^[A-Za-z]{2}[0-9]{1,4}$/;

  function validate(services, input) {
    var errors = {};
    var svc = null;
    (services || []).forEach(function (s) { if (s.id === input.service) svc = s; });
    if (!svc) {
      errors.service = "Please choose a service";
      return { ok: false, errors: errors, service: null };
    }
    if (svc.needsFlight && !FLIGHT_RE.test(String(input.flight || "").trim())) {
      errors.flight = "Enter a flight number such as BA123 (2 letters, then 1 to 4 digits)";
    }
    if (svc.byTime) {
      var h = Number(input.hours);
      if (String(input.hours === undefined || input.hours === null ? "" : input.hours).trim() === "" ||
          !Number.isInteger(h) || h < 1 || h > 12) {
        errors.hours = "Enter whole hours from 1 to 12";
      }
    }
    return { ok: Object.keys(errors).length === 0, errors: errors, service: svc };
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  function open() {
    var s1 = document.getElementById("step-service");
    var s2 = document.getElementById("step-details");
    if (s2) s2.hidden = true;
    if (s1) s1.hidden = false;
  }

  function init() {
    var host = document.getElementById("step-service");
    var services = (window.PHC_DATA && PHC_DATA.services) || [];
    if (!host || !services.length) return;

    var draft = PHCStore.get("draftBooking") || {};
    var chosen = draft.service || "";
    host.textContent = "";

    host.appendChild(el("h2", { id: "h-service" }, "1. Choose a service"));
    host.setAttribute("aria-labelledby", "h-service");

    var group = el("div", { "class": "stack", role: "group", "aria-labelledby": "h-service" });
    var buttons = {};
    services.forEach(function (s) {
      var b = el("button", { type: "button", "class": "choice", "data-service": s.id, "aria-pressed": "false" });
      b.appendChild(el("strong", null, s.name));
      b.appendChild(el("span", { "class": "muted" }, " · from £" + s.fromPrice + (s.byTime ? " per hour" : "")));
      b.appendChild(el("br"));
      b.appendChild(el("span", { "class": "muted" }, s.description));
      buttons[s.id] = b;
      group.appendChild(b);
    });
    host.appendChild(group);

    var errService = el("p", { "class": "error", id: "err-service", role: "alert" });
    host.appendChild(errService);

    var form = el("div", { "class": "form" });

    var flightField = el("div", { "class": "field", id: "field-flight", hidden: "" });
    flightField.appendChild(el("label", { "for": "flight" }, "Flight number"));
    var flight = el("input", { id: "flight", type: "text", maxlength: "6", placeholder: "BA123", autocomplete: "off" });
    flight.value = draft.flight || "";
    flightField.appendChild(flight);

    var hoursField = el("div", { "class": "field", id: "field-hours", hidden: "" });
    hoursField.appendChild(el("label", { "for": "hours" }, "Number of hours (1 to 12)"));
    var hours = el("input", { id: "hours", type: "number", min: "1", max: "12", step: "1", inputmode: "numeric" });
    hours.value = draft.hours || "";
    hoursField.appendChild(hours);

    var next = el("button", { type: "button", "class": "btn btn-primary", id: "service-continue" }, "Continue");
    form.appendChild(flightField);
    form.appendChild(hoursField);
    form.appendChild(next);
    host.appendChild(form);
    var status = el("p", { "class": "success", id: "service-saved", role: "status" });
    host.appendChild(status);

    function selectedService() {
      return services.filter(function (s) { return s.id === chosen; })[0] || null;
    }

    function refresh() {
      var svc = selectedService();
      Object.keys(buttons).forEach(function (id) {
        var on = id === chosen;
        buttons[id].classList.toggle("selected", on);
        buttons[id].setAttribute("aria-pressed", on ? "true" : "false");
      });
      flightField.hidden = !(svc && svc.needsFlight);
      hoursField.hidden = !(svc && svc.byTime);
    }

    Object.keys(buttons).forEach(function (id) {
      buttons[id].addEventListener("click", function () {
        chosen = id;
        errService.textContent = "";
        status.textContent = "";
        PHCUI.clearFieldError(flight);
        PHCUI.clearFieldError(hours);
        refresh();
      });
    });

    next.addEventListener("click", function () {
      var input = { service: chosen, flight: flight.value.trim().toUpperCase(), hours: hours.value };
      var r = validate(services, input);
      status.textContent = "";
      errService.textContent = r.errors.service || "";
      if (r.errors.flight) PHCUI.setFieldError(flight, r.errors.flight); else PHCUI.clearFieldError(flight);
      if (r.errors.hours) PHCUI.setFieldError(hours, r.errors.hours); else PHCUI.clearFieldError(hours);
      if (!r.ok) {
        var firstBad = r.errors.flight ? flight : (r.errors.hours ? hours : null);
        if (firstBad) firstBad.focus();
        return;
      }
      var saved = PHCStore.update("draftBooking", function (d) {
        d = d || {};
        delete d.flight;
        delete d.hours;
        d.service = input.service;
        if (r.service.needsFlight) d.flight = input.flight;
        if (r.service.byTime) d.hours = Number(input.hours);
        return d;
      });
      flight.value = input.flight;
      var step2 = document.getElementById("step-details");
      if (step2 && (step2.children.length || window.PHCBookDetails)) {
        host.hidden = true;
        step2.hidden = false;
        if (window.PHCBookDetails) window.PHCBookDetails.open(); // US05 fills step 2
      } else {
        // Step 2 (US05) is not built yet: confirm the choice instead of leaving a blank page.
        var svcName = r.service.name + (r.service.needsFlight ? " · flight " + input.flight : "") +
          (r.service.byTime ? " · " + Number(input.hours) + " h" : "");
        status.textContent = "Saved: " + svcName + ". Journey details come next.";
      }
      document.dispatchEvent(new CustomEvent("phc:service-chosen", { detail: saved }));
    });

    // Saved choice (reload, or coming back from a later step) is shown again.
    refresh();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }

  return { validate: validate, init: init, open: open, FLIGHT_RE: FLIGHT_RE };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHCService;
}
