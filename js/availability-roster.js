/* PHC-13 US15: make registered drivers visible on Staff Availability, including unassigned drivers. */
(function () {
  "use strict";
  var main = document.getElementById("main");
  if (!main || !document.getElementById("availability-form")) return;
  var section = document.createElement("section");
  section.className = "card availability-roster";
  section.setAttribute("aria-labelledby", "registered-drivers-heading");
  var header = document.createElement("div"); header.className = "availability-roster-header";
  var heading = document.createElement("h2"); heading.id = "registered-drivers-heading"; heading.textContent = "Registered drivers";
  var link = document.createElement("a"); link.href = "fleet.html"; link.className = "btn btn-ghost btn-sm"; link.textContent = "Manage fleet & accounts";
  header.appendChild(heading); header.appendChild(link);
  var summary = document.createElement("p"); summary.className = "muted"; summary.setAttribute("aria-live", "polite");
  var wrap = document.createElement("div"); wrap.className = "table-wrap";
  var table = document.createElement("table");
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  ["Driver", "Contact", "Assigned minicab"].forEach(function (name) { var th = document.createElement("th"); th.scope = "col"; th.textContent = name; hr.appendChild(th); });
  thead.appendChild(hr); table.appendChild(thead);
  var tbody = document.createElement("tbody"); table.appendChild(tbody); wrap.appendChild(table);
  section.appendChild(header); section.appendChild(summary); section.appendChild(wrap);
  main.appendChild(section);
  function render() {
    var drivers = PHCStore.get("drivers") || [];
    var cars = PHCStore.get("cars") || [];
    var assigned = {};
    cars.forEach(function (car) { if (car.driverId) assigned[car.driverId] = car.registration + " · " + car.make; });
    summary.textContent = drivers.length + " registered driver(s) in shared prototype data";
    tbody.replaceChildren();
    if (!drivers.length) {
      var empty = document.createElement("tr"); var cell = document.createElement("td"); cell.colSpan = 3; cell.textContent = "No drivers registered"; empty.appendChild(cell); tbody.appendChild(empty);
    }
    drivers.forEach(function (driver) {
      var row = document.createElement("tr");
      [driver.name, driver.phone, assigned[driver.id] || "Unassigned"].forEach(function (value) {
        var cell = document.createElement("td"); cell.textContent = value || "—"; row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
  }
  document.addEventListener("phc:reset", render);
  window.addEventListener("storage", function (event) { if (event.key === PHCStore.KEY) render(); });
  render();
})();
