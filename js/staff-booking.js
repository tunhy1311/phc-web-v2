(function () {
  "use strict";

  var root = document.getElementById("page-root");
  var esc = PHCUI.escapeHtml;
  var selectedId = null;
  var FIELDS = {
    pickup: "#nb-pickup", destination: "#nb-destination", date: "#nb-date", time: "#nb-time",
    passengers: "#nb-passengers", hours: "#nb-hours", flight: "#nb-flight",
    service: "#nb-service", channel: "#nb-channel", carSize: "#nb-carsize"
  };
  var CUSTOMER_FIELDS = ["name", "email", "phone", "address", "postcode"];

  function money(n) {
    return "£" + Number(n).toFixed(2);
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function todayLocal() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function newId(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function customers() {
    return PHCStore.get("customers") || [];
  }

  function selectedCustomer() {
    return customers().filter(function (c) { return c.id === selectedId; })[0] || null;
  }

  function findService(id) {
    return PHC_DATA.services.filter(function (s) { return s.id === id; })[0] || null;
  }

  function q(sel) {
    return root.querySelector(sel);
  }

  function focusHeading(el) {
    var h2 = el && el.querySelector("h2");
    if (!h2) return;
    h2.setAttribute("tabindex", "-1");
    h2.focus({ preventScroll: true });
    el.scrollIntoView({ block: "start" });
  }

  function renderRefused() {
    root.innerHTML =
      '<div class="card">' +
        "<h2>Access refused</h2>" +
        "<p>Sign in as call centre staff to make a booking for a customer.</p>" +
        '<div class="actions">' +
          '<a class="btn btn-primary" href="' + esc(PHCUI.url("staff/login.html") + "?next=" + encodeURIComponent("new-booking.html")) + '">Staff sign in</a>' +
        "</div>" +
      "</div>";
  }

  function render() {
    if (!PHCStaffAuth.current()) {
      renderRefused();
      return;
    }
    root.innerHTML =
      '<div class="nb-layout">' +
        '<section class="card" id="nb-customer" aria-labelledby="nb-customer-title"></section>' +
        '<section class="card" id="nb-booking" aria-labelledby="nb-booking-title"></section>' +
      "</div>";
    renderCustomer();
    renderBooking();
  }

  function renderCustomer() {
    var box = q("#nb-customer");
    var c = selectedCustomer();
    if (c) {
      box.innerHTML =
        '<h2 id="nb-customer-title">Customer</h2>' +
        '<dl class="summary-list">' +
          "<div><dt>Name</dt><dd>" + esc(c.name) + "</dd></div>" +
          "<div><dt>Phone</dt><dd>" + esc(c.phone) + "</dd></div>" +
          "<div><dt>Email</dt><dd>" + esc(c.email) + "</dd></div>" +
          "<div><dt>Postcode</dt><dd>" + esc(c.postcode || "") + "</dd></div>" +
        "</dl>" +
        '<p class="hint-box">Ask the caller to confirm their postcode and date of birth before you book.</p>' +
        '<div class="actions"><button type="button" class="btn btn-ghost btn-sm" id="nb-change-customer">Change customer</button></div>';
      q("#nb-change-customer").addEventListener("click", function () {
        selectedId = null;
        renderCustomer();
        renderBooking();
        q("#nb-search").focus();
      });
      return;
    }

    box.innerHTML =
      '<h2 id="nb-customer-title">Customer</h2>' +
      '<form class="form" id="nb-search-form" novalidate>' +
        '<div class="field">' +
          '<label for="nb-search">Caller\'s phone number or email</label>' +
          '<div class="nb-search-row">' +
            '<input id="nb-search" name="query" type="text" autocomplete="off" placeholder="e.g. 07123 456789">' +
            '<button type="submit" class="btn btn-primary">Find</button>' +
          "</div>" +
        "</div>" +
      "</form>" +
      '<div id="nb-results" role="status"></div>' +
      '<p><button type="button" class="link-btn" id="nb-new-link">Create a new customer</button></p>' +
      '<div id="nb-new-customer" hidden></div>';

    q("#nb-search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      search(q("#nb-search").value);
    });
    q("#nb-new-link").addEventListener("click", function () {
      openNewCustomer(q("#nb-search").value);
    });
  }

  function search(query) {
    var results = q("#nb-results");
    var input = q("#nb-search");
    PHCUI.clearFieldError(input);
    if (!query.trim()) {
      results.innerHTML = "";
      PHCUI.setFieldError(input, "Enter a phone number or email");
      input.focus();
      return;
    }
    var found = PHCStaffBooking.findCustomers(customers(), query);
    if (!found.length) {
      results.innerHTML =
        '<p class="nb-none">No customer found for <strong>' + esc(query.trim()) + "</strong>. Create a new customer below.</p>";
      return;
    }
    results.innerHTML =
      '<ul class="nb-matches">' +
        found.map(function (c) {
          return (
            '<li class="nb-match">' +
              "<span><strong>" + esc(c.name) + '</strong><span class="muted nb-match-text">' +
                esc(c.phone) + " · " + esc(c.email) + " · " + esc(c.postcode || "") + "</span></span>" +
              '<button type="button" class="btn btn-primary btn-sm" data-id="' + esc(c.id) + '">Use this customer</button>' +
            "</li>"
          );
        }).join("") +
      "</ul>";
    Array.prototype.forEach.call(results.querySelectorAll("button[data-id]"), function (btn) {
      btn.addEventListener("click", function () { selectCustomer(btn.getAttribute("data-id")); });
    });
  }

  function selectCustomer(id) {
    selectedId = id;
    renderCustomer();
    renderBooking();
    focusHeading(q("#nb-booking"));
  }

  function customerField(name, label, type, value, autocomplete) {
    return (
      '<div class="field">' +
        '<label for="nc-' + name + '">' + esc(label) + "</label>" +
        '<input id="nc-' + name + '" name="' + name + '" type="' + type + '" autocomplete="' + autocomplete + '" value="' + esc(value || "") + '">' +
      "</div>"
    );
  }

  function openNewCustomer(query) {
    var box = q("#nb-new-customer");
    var text = (query || "").trim();
    var isEmail = text.indexOf("@") !== -1;
    q("#nb-results").innerHTML = "";
    box.hidden = false;
    box.innerHTML =
      "<h3>New customer</h3>" +
      '<form class="form" id="nc-form" novalidate>' +
        customerField("name", "Full name", "text", "", "off") +
        '<div class="field-row">' +
          customerField("phone", "Phone", "tel", isEmail ? "" : text, "off") +
          customerField("email", "Email", "email", isEmail ? text : "", "off") +
        "</div>" +
        customerField("address", "Address", "text", "", "off") +
        customerField("postcode", "Postcode", "text", "", "off") +
        '<div class="actions">' +
          '<button type="submit" class="btn btn-primary">Save customer</button>' +
          '<button type="button" class="btn btn-ghost" id="nc-cancel">Cancel</button>' +
        "</div>" +
      "</form>";

    var form = q("#nc-form");
    form.addEventListener("input", function (e) { if (e.target.id) PHCUI.clearFieldError(e.target); });
    q("#nc-cancel").addEventListener("click", function () {
      box.hidden = true;
      box.innerHTML = "";
      q("#nb-search").focus();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      saveNewCustomer(form);
    });
    form.querySelector("#nc-name").focus();
  }

  function saveNewCustomer(form) {
    var data = {};
    CUSTOMER_FIELDS.forEach(function (k) { data[k] = form.elements[k].value; });
    var check = PHCStaffBooking.validateNewCustomer(data, customers());
    var firstInvalid = null;
    CUSTOMER_FIELDS.forEach(function (k) {
      var input = form.elements[k];
      if (check.errors[k]) {
        PHCUI.setFieldError(input, check.errors[k]);
        firstInvalid = firstInvalid || input;
      } else {
        PHCUI.clearFieldError(input);
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }
    var customer = PHCStaffBooking.buildCustomer(data, newId("c"));
    PHCStore.update("customers", function (list) {
      list = Array.isArray(list) ? list : [];
      list.push(customer);
      return list;
    });
    selectCustomer(customer.id);
  }

  function channelOption(value, label) {
    return (
      '<label class="choice size-choice">' +
        '<input type="radio" name="channel" value="' + value + '">' +
        "<span><strong>" + esc(label) + "</strong></span>" +
      "</label>"
    );
  }

  function sizeOption(size, text) {
    return (
      '<label class="choice size-choice">' +
        '<input type="radio" name="carSize" value="' + size + '">' +
        "<span><strong>" + size + '-seater</strong><span class="muted size-text">' + esc(text) + "</span></span>" +
      "</label>"
    );
  }

  function renderBooking() {
    var box = q("#nb-booking");
    if (!selectedCustomer()) {
      box.innerHTML =
        '<h2 id="nb-booking-title">Booking details</h2>' +
        '<p class="muted">Find or create the customer first.</p>';
      return;
    }

    box.innerHTML =
      '<h2 id="nb-booking-title">Booking details</h2>' +
      '<form class="form" id="nb-form" novalidate>' +
        '<fieldset class="field">' +
          "<legend>Channel</legend>" +
          '<div class="size-options" id="nb-channel">' +
            channelOption("phone", "Phone") +
            channelOption("in-person", "In person") +
          "</div>" +
        "</fieldset>" +
        '<div class="field">' +
          '<label for="nb-service">Service</label>' +
          '<select id="nb-service" name="service">' +
            '<option value="">Choose a service</option>' +
            PHC_DATA.services.map(function (s) {
              return '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>";
            }).join("") +
          "</select>" +
        "</div>" +
        '<div class="field">' +
          '<label for="nb-pickup">Pick-up address</label>' +
          '<input id="nb-pickup" name="pickup" type="text" maxlength="120">' +
        "</div>" +
        '<div class="field">' +
          '<label for="nb-destination">Destination</label>' +
          '<input id="nb-destination" name="destination" type="text" maxlength="120">' +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field">' +
            '<label for="nb-date">Date</label>' +
            '<input id="nb-date" name="date" type="date" min="' + todayLocal() + '">' +
          "</div>" +
          '<div class="field">' +
            '<label for="nb-time">Time</label>' +
            '<input id="nb-time" name="time" type="time">' +
          "</div>" +
        "</div>" +
        '<div class="field">' +
          '<label for="nb-passengers">Number of passengers</label>' +
          '<input id="nb-passengers" name="passengers" type="number" inputmode="numeric" min="1" max="7" step="1">' +
        "</div>" +
        '<fieldset class="field">' +
          "<legend>Car size</legend>" +
          '<div class="size-options" id="nb-carsize">' +
            sizeOption(4, "Up to 4 passengers, 2 large cases") +
            sizeOption(7, "Up to 7 passengers, 4 large cases") +
          "</div>" +
        "</fieldset>" +
        '<div class="field" id="nb-hours-field" hidden>' +
          '<label for="nb-hours">Hours of hire</label>' +
          '<input id="nb-hours" name="hours" type="number" inputmode="numeric" min="1" max="' + PHCRules.MAX_HIRE_HOURS + '" step="1">' +
        "</div>" +
        '<div class="field" id="nb-flight-field" hidden>' +
          '<label for="nb-flight">Flight number <span class="muted">(optional)</span></label>' +
          '<input id="nb-flight" name="flight" type="text" maxlength="10" autocomplete="off" placeholder="e.g. BA117">' +
        "</div>" +
        '<div id="nb-price" aria-live="polite"></div>' +
        '<div class="actions">' +
          '<button type="submit" class="btn btn-primary">Save booking</button>' +
        "</div>" +
      "</form>";

    var form = q("#nb-form");
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      saveBooking(form);
    });
    updateForm(form);
  }

  function onEdit(e) {
    var form = e.currentTarget;
    var t = e.target;
    if (t.name === "channel") PHCUI.clearFieldError(q("#nb-channel"));
    else if (t.name === "carSize") PHCUI.clearFieldError(q("#nb-carsize"));
    else if (t.id) PHCUI.clearFieldError(t);
    if (t.name === "time") PHCUI.clearFieldError(q("#nb-date"));
    updateForm(form);
  }

  function readForm(form) {
    function val(name) {
      var el = form.elements[name];
      return el && el.value ? String(el.value).trim() : "";
    }
    return {
      channel: val("channel"),
      service: val("service"),
      pickup: val("pickup"),
      destination: val("destination"),
      date: val("date"),
      time: val("time"),
      passengers: val("passengers"),
      carSize: val("carSize") ? Number(val("carSize")) : "",
      hours: val("hours"),
      flight: val("flight")
    };
  }

  function updateForm(form) {
    var v = readForm(form);
    var service = findService(v.service);
    Array.prototype.forEach.call(form.querySelectorAll(".size-choice"), function (label) {
      label.classList.toggle("selected", label.querySelector("input").checked);
    });
    q("#nb-hours-field").hidden = !(service && service.byTime);
    q("#nb-flight-field").hidden = !(service && service.needsFlight);

    var price = q("#nb-price");
    var hoursOk = service && (!service.byTime || (Number(v.hours) >= 1 && Number(v.hours) <= PHCRules.MAX_HIRE_HOURS));
    if (!service || !hoursOk) {
      price.innerHTML = '<p class="muted">Choose a service' + (service ? " and the hours" : "") + " to see the price.</p>";
      return;
    }
    var p = PHCStaffBooking.price(service, v.hours, v.channel || "phone");
    price.innerHTML =
      '<dl class="summary-list price-list">' +
        "<div><dt>Fare" + (service.byTime ? " (" + esc(v.hours) + " h × " + money(service.fromPrice) + ")" : "") + "</dt><dd>" + money(p.base) + "</dd></div>" +
        "<div><dt>Online discount</dt><dd>Not applied (phone or in person)</dd></div>" +
        '<div class="total"><dt>Total</dt><dd>' + money(p.total) + "</dd></div>" +
      "</dl>";
  }

  function saveBooking(form) {
    var staff = PHCStaffAuth.current();
    var customer = selectedCustomer();
    if (!staff || !customer) {
      render();
      return;
    }
    var v = readForm(form);
    var service = findService(v.service);
    var result = PHCStaffBooking.validateStaffBooking(v, service, new Date());
    var firstInvalid = null;
    Object.keys(FIELDS).forEach(function (key) {
      var el = q(FIELDS[key]);
      if (!el || (el.closest("[hidden]"))) return;
      if (result.errors[key]) {
        PHCUI.setFieldError(el, result.errors[key]);
        firstInvalid = firstInvalid || (el.querySelector ? el.querySelector("input") || el : el);
      } else {
        PHCUI.clearFieldError(el);
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    var booking = PHCStaffBooking.buildBooking({
      id: newId("b"),
      customer: customer,
      service: service,
      details: v,
      pickupAt: result.pickupAt,
      channel: v.channel,
      staffId: staff.id,
      createdAt: new Date().toISOString()
    });
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
    renderSaved(booking, customer);
  }

  function renderSaved(booking, customer) {
    root.innerHTML =
      '<section class="card" id="nb-saved">' +
        '<h2 class="success">Booking saved</h2>' +
        "<p>Reference <strong>" + esc(booking.id.toUpperCase()) + "</strong> · " +
          '<span class="badge">' + esc(booking.tag) + "</span> " +
          '<span class="badge badge-busy">Unpaid</span></p>' +
        '<dl class="summary-list">' +
          "<div><dt>Customer</dt><dd>" + esc(customer.name) + "</dd></div>" +
          "<div><dt>Channel</dt><dd>" + esc(PHCStaffBooking.CHANNELS[booking.channel]) + "</dd></div>" +
          "<div><dt>Service</dt><dd>" + esc(booking.serviceName) + "</dd></div>" +
          "<div><dt>From</dt><dd>" + esc(booking.pickup) + "</dd></div>" +
          "<div><dt>To</dt><dd>" + esc(booking.destination) + "</dd></div>" +
          "<div><dt>Pick-up</dt><dd>" + esc(new Date(booking.pickupAt).toLocaleString("en-GB", {
            weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
          })) + "</dd></div>" +
          "<div><dt>Passengers</dt><dd>" + esc(booking.passengers) + " · " + esc(booking.carSize) + "-seater</dd></div>" +
        "</dl>" +
        '<dl class="summary-list price-list">' +
          '<div class="total"><dt>Total (no online discount)</dt><dd>' + money(booking.total) + "</dd></div>" +
        "</dl>" +
        '<div class="actions">' +
          '<a class="btn btn-primary" href="' + esc(PHCUI.url("customer/payment.html") + "?booking=" + encodeURIComponent(booking.id)) + '">Take card payment now</a>' +
          '<button type="button" class="btn btn-ghost" id="nb-again">New booking</button>' +
        "</div>" +
      "</section>";
    q("#nb-again").addEventListener("click", function () {
      selectedId = null;
      render();
      q("#nb-search").focus();
    });
    focusHeading(q("#nb-saved"));
  }

  document.addEventListener("phc:session-change", render);
  document.addEventListener("phc:reset", function () {
    selectedId = null;
    render();
  });

  render();
})();
