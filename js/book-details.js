/*
 * US05 - Book a minicab online with journey details (owner: Phuc.N)
 * Fills #step-details (journey form) and #step-summary (summary, price, confirm) on customer/book.html.
 * Load after: data.js, store.js, ui.js, rules.js.
 *
 * How it connects to US04 (#step-service, owner: Huy):
 *   - US04 writes draftBooking = { service, flight?, hours? }, then hides #step-service and shows #step-details.
 *     This script notices #step-details becoming visible and fills it. US04 can also call PHCBookDetails.open().
 *   - "service" may be a service id ("airport") or a service object with an id.
 *   - Deep link (also handy for testing): customer/book.html?service=airport opens the details step directly.
 *
 * Login (acceptance criterion 2): a visitor who is not signed in as a customer is sent to
 *   customer/login.html?next=customer%2Fbook.html
 * The login page should send the customer back to PHCUI.url(next) after signing in.
 * The draft is kept in draftBooking (with resumeStep: "details"), so the form opens again with the same values.
 *
 * Saved booking (pushed to state.bookings, its id is added to customer.bookings):
 *   { id, customerId, serviceId, serviceName, flight, hours,
 *     pickup, destination, pickupAt ("YYYY-MM-DDTHH:MM:00", local time), passengers, carSize (4|7),
 *     baseFare, discount, total (GBP), channel: "online", tag: "Priority", status: "unpaid", createdAt (ISO) }
 */
var PHCBookDetails = (function () {
  "use strict";

  var serviceStep = document.getElementById("step-service");
  var detailsStep = document.getElementById("step-details");
  var summaryStep = document.getElementById("step-summary");
  var esc = PHCUI.escapeHtml;

  // ---------- helpers ----------

  function money(n) {
    return "£" + n.toFixed(2);
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function todayLocal() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function formatPickup(pickupAt) {
    var d = new Date(pickupAt);
    return d.toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function findService(value) {
    var id = typeof value === "string" ? value : value && value.id;
    return PHC_DATA.services.filter(function (s) { return s.id === id; })[0] || null;
  }

  function currentCustomer() {
    var s = PHCStore.session();
    if (!s || s.role !== "customer") return null;
    return (PHCStore.get("customers") || []).filter(function (c) { return c.id === s.id; })[0] || null;
  }

  function draft() {
    return PHCStore.get("draftBooking") || {};
  }

  function saveDraft(changes) {
    return PHCStore.update("draftBooking", function (old) {
      var next = old && typeof old === "object" ? old : {};
      Object.keys(changes).forEach(function (k) { next[k] = changes[k]; });
      return next;
    });
  }

  function newId() {
    return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ---------- step switching ----------

  function showStep(name) {
    if (name === "details") {
      renderDetails();
      detailsStep.setAttribute("data-ready", "1");
    } else {
      detailsStep.removeAttribute("data-ready");
    }
    if (serviceStep) serviceStep.hidden = name !== "service";
    detailsStep.hidden = name !== "details";
    summaryStep.hidden = name !== "summary";
    var section = (name === "details" ? detailsStep : name === "summary" ? summaryStep : serviceStep);
    focusHeading(section);
  }

  // Moves keyboard/screen-reader focus to the step heading and scrolls the step below the sticky header.
  function focusHeading(section) {
    var h2 = section && section.querySelector("h2");
    if (!h2) return;
    h2.setAttribute("tabindex", "-1");
    h2.focus({ preventScroll: true });
    section.scrollIntoView({ block: "start" });
  }

  function goToLogin() {
    saveDraft({ resumeStep: "details" });
    window.location.replace(PHCUI.url("customer/login.html") + "?next=" + encodeURIComponent("customer/book.html"));
  }

  function backToService() {
    if (serviceStep && serviceStep.children.length) {
      showStep("service");
    } else {
      // US04 not on the page yet: send the customer to the services on the home page.
      window.location.href = PHCUI.url("index.html") + "#services-title";
    }
  }

  // ---------- step 2: journey details ----------

  function renderDetails() {
    var d = draft();
    var service = findService(d.service);

    if (!service) {
      detailsStep.innerHTML =
        '<div class="card">' +
          "<h2>Journey details</h2>" +
          "<p>Please choose a service first.</p>" +
          '<div class="actions"><button type="button" class="btn btn-primary" data-act="back">Choose a service</button></div>' +
        "</div>";
      detailsStep.querySelector('[data-act="back"]').addEventListener("click", backToService);
      return;
    }

    var session = PHCStore.session();
    if (session && session.role === "staff") {
      detailsStep.innerHTML =
        '<div class="card">' +
          "<h2>Journey details</h2>" +
          "<p>You are signed in as staff. Phone bookings are made on the staff New booking page.</p>" +
          '<div class="actions"><a class="btn btn-primary" href="' + esc(PHCUI.url("staff/new-booking.html")) + '">Go to New booking</a></div>' +
        "</div>";
      return;
    }

    var v = d.details || {};
    var needHours = service.byTime && !(Number(d.hours) >= 1);
    var needFlight = service.needsFlight && !d.flight;
    var carSize = String(v.carSize || "");

    detailsStep.innerHTML =
      '<div class="card">' +
        '<p class="step-label">Step 2 of 3</p>' +
        "<h2>Journey details</h2>" +
        '<p class="muted">Service: <strong>' + esc(service.name) + "</strong> · " +
          '<button type="button" class="link-btn" data-act="change-service">Change</button></p>' +
        (currentCustomer() ? "" : '<p class="hint-box">You will be asked to sign in before you see the summary. Your details are kept.</p>') +
        '<form class="form" id="details-form" novalidate>' +
          '<div class="field">' +
            '<label for="bk-pickup">Pick-up address</label>' +
            '<input id="bk-pickup" name="pickup" type="text" autocomplete="street-address" maxlength="120" ' +
              'placeholder="e.g. 1 High St, E1 6AN" value="' + esc(v.pickup || "") + '">' +
          "</div>" +
          '<div class="field">' +
            '<label for="bk-destination">Destination</label>' +
            '<input id="bk-destination" name="destination" type="text" maxlength="120" ' +
              'placeholder="e.g. Heathrow Terminal 5" value="' + esc(v.destination || "") + '">' +
          "</div>" +
          '<div class="field-row">' +
            '<div class="field">' +
              '<label for="bk-date">Date</label>' +
              '<input id="bk-date" name="date" type="date" min="' + todayLocal() + '" value="' + esc(v.date || "") + '">' +
            "</div>" +
            '<div class="field">' +
              '<label for="bk-time">Time</label>' +
              '<input id="bk-time" name="time" type="time" value="' + esc(v.time || "") + '">' +
            "</div>" +
          "</div>" +
          '<div class="field">' +
            '<label for="bk-passengers">Number of passengers</label>' +
            '<input id="bk-passengers" name="passengers" type="number" inputmode="numeric" min="1" max="7" step="1" ' +
              'value="' + esc(v.passengers == null ? "" : v.passengers) + '">' +
            '<p class="hint">Up to 7 passengers per car.</p>' +
          "</div>" +
          '<fieldset class="field">' +
            "<legend>Car size</legend>" +
            '<div class="size-options" id="bk-carsize" role="radiogroup" aria-label="Car size">' +
              sizeOption(4, "Up to 4 passengers, 2 large cases", carSize) +
              sizeOption(7, "Up to 7 passengers, 4 large cases", carSize) +
            "</div>" +
            '<div class="suggestion" id="bk-suggestion" hidden></div>' +
          "</fieldset>" +
          (needHours
            ? '<div class="field">' +
                '<label for="bk-hours">Hours of hire</label>' +
                '<input id="bk-hours" name="hours" type="number" inputmode="numeric" min="1" max="' + PHCRules.MAX_HIRE_HOURS + '" step="1" ' +
                  'value="' + esc(v.hours == null ? "" : v.hours) + '">' +
                '<p class="hint">From 1 to ' + PHCRules.MAX_HIRE_HOURS + " hours.</p>" +
              "</div>"
            : "") +
          (needFlight
            ? '<div class="field">' +
                '<label for="bk-flight">Flight number <span class="muted">(optional)</span></label>' +
                '<input id="bk-flight" name="flight" type="text" maxlength="10" autocomplete="off" ' +
                  'placeholder="e.g. BA117" value="' + esc(v.flight || "") + '">' +
                '<p class="hint">Helps your driver track a late arrival.</p>' +
              "</div>"
            : "") +
          '<div class="actions">' +
            '<button type="submit" class="btn btn-primary">Continue to summary</button>' +
            '<button type="button" class="btn btn-ghost" data-act="back">Back</button>' +
          "</div>" +
        "</form>" +
      "</div>";

    var form = detailsStep.querySelector("#details-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitDetails(form, service, needHours, needFlight);
    });
    detailsStep.querySelector('[data-act="back"]').addEventListener("click", backToService);
    detailsStep.querySelector('[data-act="change-service"]').addEventListener("click", backToService);

    // Clear a field's error as soon as the customer edits it.
    function onEdit(e) {
      var t = e.target;
      if (t.name === "carSize") {
        clearCarSizeError(form);
      } else if (t.id) {
        PHCUI.clearFieldError(t);
        if (t.name === "time") PHCUI.clearFieldError(form.querySelector("#bk-date"));
        if (t.name === "passengers") clearCarSizeError(form);
      }
    }
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
  }

  function sizeOption(size, text, selected) {
    var checked = String(size) === selected;
    return (
      '<label class="choice size-choice' + (checked ? " selected" : "") + '">' +
        '<input type="radio" name="carSize" value="' + size + '"' + (checked ? " checked" : "") + ">" +
        '<span><strong>' + size + "-seater</strong>" +
        '<span class="muted size-text">' + esc(text) + "</span></span>" +
      "</label>"
    );
  }

  function markSelectedSize(form) {
    Array.prototype.forEach.call(form.querySelectorAll(".size-choice"), function (label) {
      label.classList.toggle("selected", label.querySelector("input").checked);
    });
  }

  function clearCarSizeError(form) {
    markSelectedSize(form);
    PHCUI.clearFieldError(form.querySelector("#bk-carsize"));
    var box = form.querySelector("#bk-suggestion");
    box.hidden = true;
    box.innerHTML = "";
  }

  function readForm(form) {
    function val(name) {
      var el = form.elements[name];
      return el ? el.value.trim() : "";
    }
    var size = form.querySelector('input[name="carSize"]:checked');
    return {
      pickup: val("pickup"),
      destination: val("destination"),
      date: val("date"),
      time: val("time"),
      passengers: val("passengers"),
      carSize: size ? Number(size.value) : "",
      hours: val("hours"),
      flight: val("flight").toUpperCase()
    };
  }

  function submitDetails(form, service, needHours, needFlight) {
    var values = readForm(form);
    var d = draft();
    var hours = needHours ? values.hours : d.hours;

    var result = PHCRules.validateBooking({
      pickup: values.pickup,
      destination: values.destination,
      date: values.date,
      time: values.time,
      passengers: values.passengers,
      carSize: values.carSize,
      byTime: service.byTime,
      hours: hours
    }, new Date());

    var errors = result.errors;
    if (needFlight && values.flight && !/^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/.test(values.flight)) {
      errors.flight = "Enter a flight number like BA117";
    }

    // Field-by-field errors, shown right next to each field.
    var fields = { pickup: "#bk-pickup", destination: "#bk-destination", date: "#bk-date", time: "#bk-time",
      passengers: "#bk-passengers", hours: "#bk-hours", flight: "#bk-flight" };
    var firstInvalid = null;
    Object.keys(fields).forEach(function (name) {
      var input = form.querySelector(fields[name]);
      if (!input) return;
      if (errors[name]) {
        PHCUI.setFieldError(input, errors[name]);
        firstInvalid = firstInvalid || input;
      } else {
        PHCUI.clearFieldError(input);
      }
    });

    var sizeGroup = form.querySelector("#bk-carsize");
    var suggestion = form.querySelector("#bk-suggestion");
    clearCarSizeError(form);
    if (errors.carSize) {
      PHCUI.setFieldError(sizeGroup, errors.carSize);
      firstInvalid = firstInvalid || sizeGroup.querySelector("input");
      if (result.suggestedCarSize) {
        suggestion.innerHTML =
          '<button type="button" class="btn btn-sm">Switch to a ' + result.suggestedCarSize + "-seater</button>";
        suggestion.hidden = false;
        suggestion.querySelector("button").addEventListener("click", function () {
          var radio = form.querySelector('input[name="carSize"][value="' + result.suggestedCarSize + '"]');
          radio.checked = true;
          clearCarSizeError(form);
          radio.focus();
        });
      }
    }

    // Keep what was typed, even when there are errors.
    var stored = {
      pickup: values.pickup,
      destination: values.destination,
      date: values.date,
      time: values.time,
      passengers: values.passengers === "" ? null : Number(values.passengers),
      carSize: values.carSize || null
    };
    if (needHours) stored.hours = values.hours === "" ? null : Number(values.hours);
    if (needFlight) stored.flight = values.flight;
    saveDraft({ details: stored });

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    if (!currentCustomer()) {
      goToLogin();
      return;
    }

    var changes = { pickupAt: result.pickupAt };
    if (needHours) changes.hours = Number(values.hours);
    if (needFlight && values.flight) changes.flight = values.flight;
    saveDraft(changes);
    renderSummary();
    showStep("summary");
  }

  // ---------- step 3: summary and price ----------

  function priceFor(service, d) {
    var base = PHCRules.baseFare(service, service.byTime ? { hours: Number(d.hours) } : undefined);
    var total = PHCRules.applyOnlineDiscount(base);
    return { base: base, discount: Math.round((base - total) * 100) / 100, total: total };
  }
  function availabilityFor(
    carSize,
    pickupAt,
    passengers,
    requestedHours
  ) {
    return PHCRules.vehicleAvailability(
      PHCStore.get("cars") || [],
      PHCStore.get("bookings") || [],
      carSize,
      pickupAt,
      passengers,
      requestedHours
    );
  }

  function renderSummary() {
    var d = draft();
    var service = findService(d.service);
    var v = d.details || {};
    var customer = currentCustomer();
    var price = priceFor(service, d);
    var availability = availabilityFor(
      v.carSize,
      d.pickupAt,
      v.passengers,
      service.byTime ? d.hours : 2
    );

    var rows = [
      ["Service", service.name],
      ["Pick-up", v.pickup],
      ["Destination", v.destination],
      ["Date and time", formatPickup(d.pickupAt)],
      ["Passengers", String(v.passengers)],
      ["Car size", v.carSize + "-seater"]
    ];
    if (service.byTime) rows.push(["Hours of hire", String(d.hours)]);
    if (service.needsFlight) rows.push(["Flight number", d.flight || "Not given"]);
    if (customer) rows.push(["Booked by", customer.name]);
    rows.push([
      "Vehicle availability",
      availability.available
        ? "Available (" + availability.count + " vehicle(s))"
        : "Not available"
    ]);

    var availabilityMessage;

    if (availability.available) {
      availabilityMessage =
        '<p class="hint-box">A ' + esc(String(v.carSize)) +
        '-seater is available for the selected time.</p>';
    } else {
      var suggestion = "";

      if (availability.alternativeSize) {
        suggestion +=
          " Try a " +
          availability.alternativeSize +
          "-seater.";
      }

      if (availability.nextTime) {
        suggestion +=
          " Or try " +
          esc(formatPickup(availability.nextTime)) +
          ".";
      } else {
        suggestion +=
          " Please choose another date or time.";
      }

      availabilityMessage =
        '<p class="error" role="alert">' +
        "Not available for the selected size and time." +
        suggestion +
        "</p>";
    }

    summaryStep.innerHTML =
      '<div class="card">' +
        '<p class="step-label">Step 3 of 3</p>' +
        "<h2>Check your booking</h2>" +
        '<dl class="summary-list">' +
          rows.map(function (r) {
            return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
          }).join("") +
        "</dl>" +
        availabilityMessage +
        '<dl class="summary-list price-list">' +
          "<div><dt>Fare" + (service.byTime ? " (" + esc(d.hours) + " h × " + money(service.fromPrice) + ")" : "") +
            "</dt><dd>" + money(price.base) + "</dd></div>" +
          "<div><dt>Online discount (" + Math.round(PHCRules.ONLINE_DISCOUNT * 100) + "%)</dt><dd>−" + money(price.discount) + "</dd></div>" +
          '<div class="total"><dt>Total</dt><dd>' + money(price.total) + "</dd></div>" +
        "</dl>" +
        '<p class="muted">Online bookings are tagged <span class="badge badge-accent">Priority</span> ahead of phone bookings.</p>' +
        '<div class="actions">' +
          '<button type="button" class="btn btn-primary" id="bk-confirm">Confirm booking</button>' +
          '<button type="button" class="btn btn-ghost" data-act="edit">Edit details</button>' +
        "</div>" +
        '<p class="error" id="bk-confirm-error" role="alert"></p>' +
      "</div>";

    summaryStep.querySelector('[data-act="edit"]').addEventListener("click", function () {
      showStep("details");
    });
    var confirmButton = summaryStep.querySelector("#bk-confirm");
    confirmButton.disabled = !availability.available;
    confirmButton.addEventListener("click", confirmBooking);
  }

  function assignedCar(booking) {
    return PHCVehicleAssignment.findAvailableCar(
      booking,
      PHCStore.get("cars") || [],
      PHCStore.get("bookings") || []
    );
  }

  function confirmBooking() {
    var button = summaryStep.querySelector("#bk-confirm");
    var errorBox = summaryStep.querySelector("#bk-confirm-error");
    button.disabled = true;

    var customer = currentCustomer();
    if (!customer) {
      goToLogin();
      return;
    }

    var d = draft();
    var service = findService(d.service);
    var v = d.details || {};

    // Check again: time may have passed while the summary was open.
    var check = PHCRules.validateBooking({
      pickup: v.pickup, destination: v.destination, date: v.date, time: v.time,
      passengers: v.passengers, carSize: v.carSize, byTime: service && service.byTime, hours: d.hours
    }, new Date());
    if (!service || !check.valid) {
      errorBox.textContent = check.errors.date || "Some details need changing. Please edit your details.";
      button.disabled = false;
      return;
    }
    var currentAvailability = availabilityFor(
      v.carSize,
      check.pickupAt,
      v.passengers,
      service.byTime ? d.hours : 2
    );

    if (!currentAvailability.available) {
      errorBox.textContent =
        "Not available for the selected size and time. Please edit your booking.";
      button.disabled = true;
      return;
    }

    var price = priceFor(service, d);
    var booking = {
      id: newId(),
      customerId: customer.id,
      serviceId: service.id,
      serviceName: service.name,
      flight: service.needsFlight ? (d.flight || "") : "",
      hours: service.byTime ? Number(d.hours) : null,
      pickup: v.pickup,
      destination: v.destination,
      pickupAt: check.pickupAt,
      passengers: Number(v.passengers),
      carSize: Number(v.carSize),
      carId: "",
      carModel: "",
      baseFare: price.base,
      discount: price.discount,
      total: price.total,
      channel: "online",
      tag: PHCRules.bookingTag("online"),
      status: "unpaid",
      createdAt: new Date().toISOString()
    };

    var car = assignedCar(booking);
    if (!car) {
      errorBox.textContent = "No suitable vehicle is available for this time. Please choose another date, time or car size.";
      button.disabled = false;
      return;
    }
    booking.carId = car.id;
    booking.carModel = car.make;

    PHCStore.update("bookings", function (list) {
      list = Array.isArray(list) ? list : [];
      list.push(booking);
      return list;
    });
    PHCStore.update("customers", function (list) {
      (list || []).forEach(function (c) {
        if (c.id === customer.id) {
          c.bookings = Array.isArray(c.bookings) ? c.bookings : [];
          c.bookings.push(booking.id);
        }
      });
      return list;
    });
    PHCStore.set("draftBooking", null);

    renderConfirmed(booking);
  }

  function renderConfirmed(booking) {
    summaryStep.innerHTML =
      '<div class="card" id="bk-confirmed">' +
        '<h2 class="success">Booking saved</h2>' +
        "<p>Reference <strong>" + esc(booking.id.toUpperCase()) + "</strong> · " +
          '<span class="badge badge-accent">' + esc(booking.tag) + "</span> " +
          '<span class="badge badge-busy">Unpaid</span></p>' +
        "<p>" + esc(booking.serviceName) + " on " + esc(formatPickup(booking.pickupAt)) + ", from " +
          esc(booking.pickup) + " to " + esc(booking.destination) + ". Total " + money(booking.total) + ".</p>" +
        "<p>Pay now to confirm it.</p>" +
        '<div class="actions">' +
          '<a class="btn btn-primary" href="' + esc(PHCUI.url("customer/payment.html") + "?booking=" + encodeURIComponent(booking.id)) + '">Pay now</a>' +
          '<a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">My bookings</a>' +
        "</div>" +
      "</div>";
    focusHeading(summaryStep);
  }

  // ---------- start-up ----------

  function open() {
    showStep("details");
  }

  function start() {
    // Fill #step-details whenever US04 (or anything else) makes it visible.
    new MutationObserver(function () {
      if (!detailsStep.hidden && !detailsStep.hasAttribute("data-ready")) {
        renderDetails();
        detailsStep.setAttribute("data-ready", "1");
      } else if (detailsStep.hidden) {
        detailsStep.removeAttribute("data-ready");
      }
    }).observe(detailsStep, { attributes: true, attributeFilter: ["hidden"] });

    var params = new URLSearchParams(window.location.search);
    var linked = findService(params.get("service") || "");
    var d = draft();

    if (linked) {
      var current = findService(d.service);
      if (!current || current.id !== linked.id) {
        PHCStore.set("draftBooking", { service: linked.id, details: d.details || null });
      }
      open();
      return;
    }

    if (d.resumeStep === "details") {
      saveDraft({ resumeStep: null });
      if (currentCustomer() && findService(d.service)) {
        open();
      }
    }
  }

  // Reset sample data clears the draft: go back to the start of the flow.
  document.addEventListener("phc:reset", function () {
    if (!detailsStep.hidden || !summaryStep.hidden) showStep("details");
  });

  start();

  return { open: open };
})();
