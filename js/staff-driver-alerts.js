/* PHC-22 US07: Staff-only driver approaching simulation. */
(function () {
  "use strict";

  var root = document.getElementById("driver-alerts-root");
  if (!root) return;

  var esc = PHCUI.escapeHtml;
  var selectedId = "";

  function isStaff() {
    return typeof PHCStaffAuth !== "undefined" &&
      PHCStaffAuth.current() !== null;
  }

  function requireStaff() {
    if (isStaff()) return true;

    root.innerHTML =
      '<section class="card stack">' +
      '<h2>Staff access required</h2>' +
      '<p>Please sign in with a staff account to access driver approaching alerts.</p>' +
      '<p><a class="btn btn-primary" href="login.html">Staff sign in</a></p>' +
      '</section>';

    return false;
  }

  function getConfirmed() {
    if (!isStaff()) return [];

    return (PHCStore.get("bookings") || [])
      .filter(PHCNotifications.confirmedBooking);
  }

  function byId(list, id) {
    return (list || []).find(function (x) {
      return x.id === id;
    });
  }

  function render() {
    if (!requireStaff()) return;

    var bookings = getConfirmed();

    if (!bookings.length) {
      root.innerHTML =
        '<section class="card stack">' +
        '<h2>No confirmed bookings</h2>' +
        '<p>Confirm a booking first, then return here to simulate the driver approaching.</p>' +
        '<p class="muted">Use a confirmed booking to preview the arrival notification.</p>' +
        '</section>';
      return;
    }

    if (!byId(bookings, selectedId)) {
      selectedId = bookings[0].id;
    }

    root.innerHTML =
      '<div class="notice-staff-grid">' +
      '<section class="card stack">' +
      '<h2>Choose a confirmed booking</h2>' +

      '<label class="field" for="staff-booking">Booking' +
      '<select id="staff-booking">' +
      bookings.map(function (b) {
        return '<option value="' + esc(b.id) + '"' +
          (selectedId === b.id ? ' selected' : '') + '>' +
          esc(b.id + " — " + (b.serviceName || "Journey")) +
          '</option>';
      }).join("") +
      '</select></label>' +

      '<div id="staff-booking-info"></div>' +

      '<label class="field" for="staff-car">Vehicle' +
      '<select id="staff-car"></select></label>' +

      '<label class="field" for="staff-minutes">Estimated arrival time' +
      '<select id="staff-minutes">' +
      '<option value="10">10 minutes</option>' +
      '<option value="12" selected>12 minutes</option>' +
      '<option value="15">15 minutes</option>' +
      '</select></label>' +

      '<div class="actions">' +
      '<button type="button" id="simulate-approach" class="btn btn-primary">' +
      'Simulate driver approaching</button>' +

      '<button type="button" id="staff-refresh" class="btn btn-ghost">' +
      'Refresh bookings</button>' +
      '</div>' +

      '<p id="staff-error" class="error" role="alert"></p>' +
      '<p class="muted notice-footnote">' +
      'Vehicle assignment and ETA are simulated; no live dispatch or GPS data is connected.' +
      '</p>' +

      '</section>' +
      '<section class="card stack">' +
      '<h2>Notification previews</h2>' +
      '<div id="approach-results" aria-live="polite">' +
      '<p class="muted">Choose a booking and simulate an approaching car.</p>' +
      '</div></section></div>';

    root.querySelector("#staff-booking")
      .addEventListener("change", function () {
        if (!requireStaff()) return;
        selectedId = this.value;
        fillDetails();
      });

    root.querySelector("#staff-refresh")
      .addEventListener("click", function () {
        if (!requireStaff()) return;
        render();
      });

    root.querySelector("#simulate-approach")
      .addEventListener("click", simulate);

    fillDetails();
  }

  function fillDetails() {
    if (!requireStaff()) return;

    var b = byId(getConfirmed(), selectedId);
    var cars = PHCStore.get("cars") || [];
    var drivers = PHCStore.get("drivers") || [];

    if (!b) return render();

    var c = byId(PHCStore.get("customers"), b.customerId);
    var notify = b.notification;

    root.querySelector("#staff-error").textContent = "";

    root.querySelector("#approach-results").innerHTML =
      '<p class="muted">Click Simulate to generate a preview.</p>';

    root.querySelector("#staff-booking-info").innerHTML =
      '<dl class="notice-dl">' +
      '<div><dt>Customer</dt><dd>' +
      esc(c ? c.name : "Unknown") +
      '</dd></div>' +

      '<div><dt>Pick-up</dt><dd>' +
      esc(b.pickup || "") +
      '</dd></div>' +

      '<div><dt>Preference</dt><dd>' +
      esc(notify ? notify.method : "Not selected yet") +
      '</dd></div></dl>' +

      (!notify ?
        '<p class="notice-warning">Customer must choose Email, Text or Both before this alert.</p>' :
        '');

    var eligible = cars.filter(function (car) {
      return PHCNotifications.canAssignCar(b, car, drivers);
    });

    var select = root.querySelector("#staff-car");

    select.innerHTML = eligible.map(function (car) {
      return '<option value="' + esc(car.id) + '"' +
        (b.assignedCarId === car.id ? ' selected' : '') + '>' +
        esc(car.registration + " · " + car.colour + " " + car.make) +
        '</option>';
    }).join("");

    if (!eligible.length) {
      select.innerHTML =
        '<option value="">No eligible cars</option>';
    }

    root.querySelector("#simulate-approach").disabled =
      !notify || !eligible.length;
  }

  function simulate() {
    if (!requireStaff()) return;

    var b = byId(getConfirmed(), selectedId);
    var cars = PHCStore.get("cars") || [];
    var drivers = PHCStore.get("drivers") || [];

    if (!b) return render();

    var car = byId(
      cars,
      root.querySelector("#staff-car").value
    );

    var driver = car && byId(drivers, car.driverId);
    var customer = byId(
      PHCStore.get("customers"),
      b.customerId
    );

    var minutes = Number(
      root.querySelector("#staff-minutes").value
    );

    if (!PHCNotifications.canAssignCar(b, car, drivers)) {
      root.querySelector("#staff-error").textContent =
        "Please select an available and eligible vehicle.";
      return;
    }

    var result = PHCNotifications.createApproachPreview(
      b, car, driver, customer, minutes
    );

    if (!result.ok) {
      root.querySelector("#staff-error").textContent =
        result.error;
      return;
    }

    // Recheck authorization immediately before updating data.
    if (!requireStaff()) return;

    PHCStore.update("bookings", function (list) {
      return (list || []).map(function (item) {
        return item.id === b.id ? result.booking : item;
      });
    });

    var html =
      '<p class="success">Simulation completed for booking ' +
      esc(b.id) + '.</p>' +

      '<p class="muted">Vehicle: ' +
      esc(result.vehicleText) +
      '. Arrival in approximately ' +
      minutes + ' minutes.</p>';

    if (result.emailPreview) {
      html +=
        '<section class="notice-preview">' +
        '<h3>Email preview</h3>' +
        '<p><strong>To:</strong> ' +
        esc(result.emailTo) + '</p>' +
        '<pre>' +
        esc(result.emailPreview) +
        '</pre></section>';
    }

    if (result.textPreview) {
      html +=
        '<section class="notice-preview">' +
        '<h3>Text preview</h3>' +
        '<p><strong>To:</strong> ' +
        esc(result.textTo) + '</p>' +
        '<p>' +
        esc(result.textPreview) +
        '</p></section>';
    }

    html +=
      '<p class="muted">No real messages were sent. ' +
      'This is not live GPS tracking.</p>';

    root.querySelector("#approach-results").innerHTML = html;
    root.querySelector("#staff-error").textContent = "";
  }

  document.addEventListener("phc:reset", function () {
    if (!requireStaff()) return;
    render();
  });

  render();
})();