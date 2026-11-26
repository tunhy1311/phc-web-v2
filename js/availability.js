/* PHC-48: Staff availability page. Uses the team's PHCStore; no direct localStorage writes. */
(function () {
  "use strict";
  var form = document.getElementById("availability-form");
  if (!form) return;

  var rows = document.getElementById("vehicle-rows");
  var summary = document.getElementById("vehicle-summary");
  var empty = document.getElementById("empty-vehicles");
  var next = document.getElementById("next-available");
  var feedback = document.getElementById("filter-feedback");
  var refreshFeedback = document.getElementById("refresh-feedback");
  var quoteResults = document.getElementById("quote-results");
  var sizeInput = document.getElementById("vehicle-size");
  var dateInput = document.getElementById("journey-date");
  var timeInput = document.getElementById("journey-time");
  var isFiltered = false;
  var lastStatuses = {};

  // Figma values are illustrative only: confirm tariffs with the pricing owner.
  var DEMO_FARES_GBP = { "4": 28, "7": 42 };

  function make(tag, text, className) {
    var element = document.createElement(tag);
    if (text !== undefined) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  }

  function getCars() { return PHCStore.get("cars") || []; }
  function getDrivers() { return PHCStore.get("drivers") || []; }
  function getBookings() { return PHCStore.get("bookings") || []; }

  function selectedAt() {
    if (!dateInput.value || !timeInput.value) return null;
    var d = new Date(dateInput.value + "T" + timeInput.value);
    return isNaN(d.getTime()) ? null : d;
  }

  // Future slot checks only work when an existing booking has BOTH pickupAt and endAt/dropoffAt.
  // There are no confirmed release times for busy cars in the initial sample dataset.
  function clashesWithKnownBooking(car, when) {
    if (!when) return false;
    return getBookings().some(function (b) {
      if (b.status === "cancelled") return false;
      if (b.carId !== car.id && b.vehicleId !== car.id) return false;
      var endValue = b.endAt || b.dropoffAt;
      if (!b.pickupAt || !endValue) return false;
      var start = new Date(b.pickupAt).getTime();
      var end = new Date(endValue).getTime();
      return isFinite(start) && isFinite(end) && when.getTime() >= start && when.getTime() < end;
    });
  }

  function results() {
    var cars = getCars();
    if (!isFiltered) return cars;
    var size = sizeInput.value;
    var when = selectedAt();
    return cars.filter(function (car) {
      return (size === "all" || String(car.size) === size) &&
        car.status === "available" && !clashesWithKnownBooking(car, when);
    });
  }

  function makeRow(car, driverName) {
    var tr = document.createElement("tr");
    var vehicleTd = document.createElement("td");
    vehicleTd.appendChild(make("strong", car.make));
    vehicleTd.appendChild(make("small", car.registration + " · " + car.colour));
    tr.appendChild(vehicleTd);
    tr.appendChild(make("td", car.size + "-Seater"));
    tr.appendChild(make("td", driverName));
    var statusTd = document.createElement("td");
    var statusClass = car.status === "available" ? "available" : "busy";
    statusTd.appendChild(make("span", statusClass === "available" ? "Available" : (car.awaitingDriver ? "No driver" : "Busy"), "vehicle-status " + statusClass));
    tr.appendChild(statusTd);
    return tr;
  }

  function demoNextTime() {
    // Demo placeholder, NOT a dispatch-confirmed next availability time.
    var start = selectedAt() || new Date();
    var proposed = new Date(start.getTime() + 30 * 60 * 1000);
    return proposed.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  }

  function render() {
    var allCars = getCars();
    var drivers = getDrivers();
    var driversById = {};
    drivers.forEach(function (driver) { driversById[driver.id] = driver.name; });
    var visible = results();
    rows.replaceChildren();
    visible.forEach(function (car) { rows.appendChild(makeRow(car, driversById[car.driverId] || "Unassigned")); });
    var availableCount = allCars.filter(function (car) { return car.status === "available"; }).length;
    summary.textContent = isFiltered
      ? visible.length + " matching available vehicle(s)"
      : allCars.length + " vehicles · " + availableCount + " available · " + (allCars.length - availableCount) + " busy";
    empty.hidden = visible.length !== 0;
    if (visible.length === 0) {
      next.textContent = "Next available time (demo estimate only): " + demoNextTime();
    }
    document.getElementById("simulate-dispatch").disabled = !allCars.some(function (car) { return car.status === "available"; });
  }

  function refresh() {
    var current = getCars();
    var changed = current.filter(function (car) {
      return Object.prototype.hasOwnProperty.call(lastStatuses, car.id) && lastStatuses[car.id] !== car.status;
    }).map(function (car) { return car.registration + " is now " + car.status; });
    current.forEach(function (car) { lastStatuses[car.id] = car.status; });
    render();
    refreshFeedback.textContent = changed.length ? "Availability updated: " + changed.join("; ") : "Availability refreshed from shared data.";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (Boolean(dateInput.value) !== Boolean(timeInput.value)) {
      feedback.textContent = "Please choose both a journey date and time, or leave both empty.";
      return;
    }
    isFiltered = true;
    feedback.textContent = "Showing matching available cars. Future availability is illustrative until dispatch schedules are supplied.";
    quoteResults.replaceChildren();
    refresh();
  });

  document.getElementById("refresh-vehicles").addEventListener("click", refresh);
  document.getElementById("clear-filters").addEventListener("click", function () {
    form.reset();
    isFiltered = false;
    feedback.textContent = "Filters cleared.";
    quoteResults.replaceChildren();
    refresh();
  });

  document.getElementById("quote-form").addEventListener("submit", function (event) {
    event.preventDefault();
    quoteResults.replaceChildren();
    var pickup = document.getElementById("pickup").value.trim();
    var destination = document.getElementById("destination").value.trim();
    if (!pickup || !destination) {
      quoteResults.appendChild(make("p", "Please enter both pick-up location and destination."));
      return;
    }
    if (pickup.toLowerCase() === destination.toLowerCase()) {
      quoteResults.appendChild(make("p", "Pick-up and destination must be different."));
      return;
    }
    var available = results().filter(function (car) { return car.status === "available"; });
    var sizes = Array.from(new Set(available.map(function (car) { return String(car.size); }))).sort();
    if (!sizes.length) {
      quoteResults.appendChild(make("p", "Quotation unavailable: no matching vehicles."));
      return;
    }
    quoteResults.appendChild(make("h3", "Indicative demo fares"));
    sizes.forEach(function (size) {
      var row = make("div", undefined, "availability-quote-row");
      row.appendChild(make("span", size + "-Seater"));
      row.appendChild(make("strong", "£" + DEMO_FARES_GBP[size]));
      quoteResults.appendChild(row);
    });
  });

  document.getElementById("simulate-dispatch").addEventListener("click", function () {
    var first = getCars().find(function (car) { return car.status === "available"; });
    if (!first) return;
    PHCStore.update("cars", function (cars) {
      return cars.map(function (car) {
        if (car.id === first.id) car.status = "busy";
        return car;
      });
    });
    // Refresh is separate to demonstrate AC5: status changes when staff refreshes.
    refreshFeedback.textContent = "Demo assignment saved. Click Refresh Availability to see the updated status.";
  });

  document.addEventListener("phc:reset", function () {
    lastStatuses = {};
    isFiltered = false;
    form.reset();
    quoteResults.replaceChildren();
    feedback.textContent = "Sample data restored.";
    refresh();
  });
  window.addEventListener("storage", function (event) {
    if (event.key === PHCStore.KEY) refresh();
  });

  getCars().forEach(function (car) { lastStatuses[car.id] = car.status; });
  render();
})();
