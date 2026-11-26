/* PHC-13 / US15 – staff-facing Fleet & Customer management. */
(function () {
  "use strict";
  var carForm = document.getElementById("car-form");
  var driverForm = document.getElementById("driver-form");
  var customerForm = document.getElementById("customer-form");
  if (!carForm || !driverForm || !customerForm) return;

  function byId(id) { return document.getElementById(id); }
  function get(key) { return PHCStore.get(key) || []; }
  function recordId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function create(tag, text) { var el = document.createElement(tag); if (text != null) el.textContent = text; return el; }
  function option(value, text) { var el = create("option", text); el.value = value; return el; }

  var forms = {
    car: { form: carForm, keys: { registration: "car-registration", make: "car-make", colour: "car-colour", size: "car-size", driverId: "car-driver" } },
    driver: { form: driverForm, keys: { name: "driver-name", licenceNumber: "driver-licence", phone: "driver-phone", carId: "driver-car" } },
    customer: { form: customerForm, keys: { name: "customer-name", email: "customer-email", phone: "customer-phone", address: "customer-address", password: "customer-password", confirm: "customer-confirm" } }
  };

  function clearErrors(kind) {
    Object.keys(forms[kind].keys).forEach(function (key) {
      var el = byId(forms[kind].keys[key]);
      el.removeAttribute("aria-invalid");
      var msg = document.querySelector('[data-error-for="' + forms[kind].keys[key] + '"]');
      if (msg) msg.textContent = "";
    });
  }
  function showErrors(kind, errors) {
    clearErrors(kind);
    var first = null;
    Object.keys(errors).forEach(function (key) {
      var id = forms[kind].keys[key];
      if (!id) return;
      var input = byId(id);
      var el = document.querySelector('[data-error-for="' + id + '"]');
      if (el) el.textContent = errors[key];
      input.setAttribute("aria-invalid", "true");
      if (!first) first = input;
    });
    if (first) first.focus();
  }
  function feedback(kind, success, title, detail) {
    var root = byId(kind + "-feedback");
    root.hidden = false;
    root.className = "staff-feedback " + (success ? "ok" : "bad");
    root.replaceChildren(create("h3", title), create("p", detail || ""));
  }
  function hideFeedback(kind) { byId(kind + "-feedback").hidden = true; }
  function formInput(kind) {
    var out = {};
    Object.keys(forms[kind].keys).forEach(function (key) {
      out[key] = byId(forms[kind].keys[key]).value;
    });
    return out;
  }

  function tabs() {
    ["car", "driver", "customer"].forEach(function (kind) {
      byId("tab-" + kind).addEventListener("click", function () {
        ["car", "driver", "customer"].forEach(function (current) {
          var active = current === kind;
          byId("tab-" + current).setAttribute("aria-selected", active ? "true" : "false");
          byId("panel-" + current).hidden = !active;
        });
      });
    });
  }

  function fillDriverAndCarChoices() {
    var cars = get("cars");
    var drivers = get("drivers");
    var assigned = new Set(cars.filter(function (c) { return !!c.driverId; }).map(function (c) { return c.driverId; }));
    var dsel = byId("car-driver");
    var csel = byId("driver-car");
    var oldDriver = dsel.value, oldCar = csel.value;
    dsel.replaceChildren(option("", "Unassigned – assign later"));
    drivers.filter(function (d) { return !assigned.has(d.id); }).forEach(function (d) { dsel.appendChild(option(d.id, d.name)); });
    csel.replaceChildren(option("", "Keep unassigned"));
    cars.filter(function (c) { return !c.driverId; }).forEach(function (c) { csel.appendChild(option(c.id, c.registration + " · " + c.make)); });
    if (Array.from(dsel.options).some(function (opt) { return opt.value === oldDriver; })) dsel.value = oldDriver;
    if (Array.from(csel.options).some(function (opt) { return opt.value === oldCar; })) csel.value = oldCar;
  }

  function rows(tbody, data, renderer, emptyLabel, cols) {
    tbody.replaceChildren();
    if (!data.length) {
      var empty = create("tr");
      var td = create("td", emptyLabel);
      td.colSpan = cols;
      empty.appendChild(td);
      tbody.appendChild(empty);
    } else data.forEach(function (item) { tbody.appendChild(renderer(item)); });
  }
  function td(text) { return create("td", text); }
  function renderRecords() {
    var cars = get("cars"), drivers = get("drivers"), customers = get("customers");
    byId("count-cars").textContent = String(cars.length);
    byId("count-drivers").textContent = String(drivers.length);
    byId("count-customers").textContent = String(customers.length);
    var byDriver = {};
    drivers.forEach(function (d) { byDriver[d.id] = d.name; });
    rows(byId("staff-cars-rows"), cars, function (car) {
      var tr = create("tr");
      var name = td("");
      name.appendChild(create("strong", car.registration));
      name.appendChild(create("div", (car.make || "") + " · " + (car.colour || ""))).className = "muted";
      tr.appendChild(name);
      tr.appendChild(td(car.size + "-seater"));
      tr.appendChild(td(byDriver[car.driverId] || "Unassigned"));
      return tr;
    }, "No minicabs registered", 3);
    rows(byId("staff-drivers-rows"), drivers, function (driver) {
      var tr = create("tr");
      tr.appendChild(td(driver.name));
      tr.appendChild(td(driver.phone));
      return tr;
    }, "No drivers registered", 2);
    fillDriverAndCarChoices();
  }

  carForm.addEventListener("submit", function (event) {
    event.preventDefault();
    hideFeedback("car");
    var result = PHCStaffRules.createCar(recordId("car"), formInput("car"), get("cars"), get("drivers"));
    if (!result.ok) {
      showErrors("car", result.errors);
      feedback("car", false, "Could not save minicab", "Please correct the highlighted fields.");
      return;
    }
    PHCStore.update("cars", function (list) { list.push(result.value); return list; });
    carForm.reset();
    clearErrors("car");
    renderRecords();
    feedback("car", true, "Minicab registered", result.value.registration + " was saved. Open Availability to see the vehicle.");
  });
  driverForm.addEventListener("submit", function (event) {
    event.preventDefault();
    hideFeedback("driver");
    var result = PHCStaffRules.createDriver(recordId("d"), formInput("driver"), get("drivers"), get("cars"));
    if (!result.ok) {
      showErrors("driver", result.errors);
      feedback("driver", false, "Could not save driver", "Please correct the highlighted fields.");
      return;
    }
    PHCStore.update("drivers", function (list) { list.push(result.value); return list; });
    if (result.assignedCarId) {
      PHCStore.update("cars", function (list) {
        list.forEach(function (car) { if (car.id === result.assignedCarId && !car.driverId) car.driverId = result.value.id; });
        return list;
      });
    }
    driverForm.reset();
    clearErrors("driver");
    renderRecords();
    feedback("driver", true, "Driver registered", result.value.name + " was saved. Open Availability to view the updated driver list.");
  });
  customerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    hideFeedback("customer");
    var input = formInput("customer");
    var result = PHCStaffRules.createCustomer(recordId("c"), input, get("customers"));
    if (input.password !== input.confirm) {
      if (result.ok) result = { ok: false, errors: { confirm: "Passwords do not match." } };
      else result.errors.confirm = "Passwords do not match.";
    }
    if (!result.ok) {
      showErrors("customer", result.errors);
      feedback("customer", false, "Could not create customer", "Please correct the highlighted fields.");
      return;
    }
    PHCStore.update("customers", function (list) { list.push(result.value); return list; });
    customerForm.reset();
    clearErrors("customer");
    renderRecords();
    var confirmation = byId("customer-confirmation-screen");
    confirmation.hidden = false;
    confirmation.replaceChildren();
    confirmation.appendChild(create("h3", "Customer account created"));
    confirmation.appendChild(create("p", "A confirmation email has been sent to " + result.value.email + "."));
    confirmation.appendChild(create("p", "Prototype simulation only — no real email was sent."));
    var again = create("button", "Create another customer");
    again.type = "button";
    again.className = "btn btn-ghost";
    again.addEventListener("click", function () { confirmation.hidden = true; customerForm.hidden = false; byId("customer-name").focus(); });
    confirmation.appendChild(again);
    customerForm.hidden = true;
  });
  ["car", "driver", "customer"].forEach(function (kind) {
    forms[kind].form.addEventListener("reset", function () {
      clearErrors(kind);
      hideFeedback(kind);
    });
  });
  document.addEventListener("phc:reset", function () {
    customerForm.hidden = false;
    byId("customer-confirmation-screen").hidden = true;
    renderRecords();
  });
  window.addEventListener("storage", function (event) {
    if (event.key === PHCStore.KEY) renderRecords();
  });
  tabs();
  renderRecords();
})();
