/*
 * US09 - View and print an online receipt (PHC-24). Owner: Huy.
 * Fills #page-root on customer/receipt.html. URL: receipt.html?booking=<booking id>
 * Load after: data.js, store.js, ui.js, auth.js, receipt-rules.js.
 *
 * All rules live in PHCReceipt (pure functions, unit tested). This file only draws the page.
 * The Print button opens the browser print view; css/receipt.css makes it one A4 page with
 * the menu and footer hidden and the booking reference at the top.
 */
(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;

  var params = new URLSearchParams(window.location.search);
  var bookingId = params.get("booking") || "";
  var customer = PHCAuth.requireCustomer("receipt.html" + (bookingId ? "?booking=" + encodeURIComponent(bookingId) : ""));
  if (!customer) return;

  root.classList.remove("placeholder");

  function money(n) {
    return (n < 0 ? "-" : "") + "£" + Math.abs(Number(n)).toFixed(2);
  }

  function row(label, value) {
    return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
  }

  function refusal(reason) {
    root.innerHTML =
      '<div class="card"><p role="alert">' + esc(PHCReceipt.reasonText(reason)) + "</p>" +
      '<p><a class="btn btn-primary" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">My bookings</a></p></div>';
  }

  function render() {
    var booking = (PHCStore.get("bookings") || []).filter(function (b) { return b.id === bookingId; })[0] || null;
    var check = PHCReceipt.canView(booking, { role: "customer", id: customer.id });
    if (!check.ok) return refusal(check.reason);

    var r = PHCReceipt.build(booking);
    var journey =
      row("Service", r.serviceName) +
      row("Date", r.date) +
      row("Pick-up time", r.time) +
      row("Pick-up", r.pickup) +
      row("Destination", r.destination) +
      row("Car size", r.carSize + "-seater") +
      row("Passengers", String(r.passengers)) +
      (r.flight ? row("Flight number", r.flight) : "") +
      (r.hours ? row("Hours hired", String(r.hours)) : "");

    var lines = r.lines.map(function (l) {
      return '<tr><td>' + esc(l.label) + '</td><td class="num">' + money(l.amount) + "</td></tr>";
    }).join("");

    root.innerHTML =
      '<article class="card receipt" aria-label="Receipt ' + esc(r.reference) + '">' +
        '<header class="receipt-head">' +
          '<p class="receipt-ref"><span class="muted">Booking reference</span> <strong id="receipt-ref">' + esc(r.reference) + "</strong></p>" +
          '<p class="muted">PrivateHire Cars · Receipt for ' + esc(customer.name) + "</p>" +
        "</header>" +
        '<h2>Journey details</h2><dl class="summary-list">' + journey + "</dl>" +
        '<h2>Cost</h2>' +
        '<table class="receipt-table"><tbody>' + lines + "</tbody>" +
          '<tfoot><tr><th scope="row">Total paid</th><td class="num" id="receipt-total">' + money(r.total) + "</td></tr></tfoot></table>" +
        '<p class="muted">Paid by ' + esc(r.paymentMethod) +
          (r.paidAt ? " on " + esc(new Date(r.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })) : "") +
          (r.paymentReference ? " (payment " + esc(r.paymentReference) + ")" : "") + ".</p>" +
      "</article>" +
      '<div class="actions no-print">' +
        '<button type="button" class="btn btn-primary" id="print-receipt">Print receipt</button>' +
        '<a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">My bookings</a>' +
      "</div>";

    document.getElementById("print-receipt").addEventListener("click", function () { window.print(); });
  }

  render();
  document.addEventListener("phc:reset", render);
})();
