/*
 * US11 - Staff mark a journey as Completed (PHC-9, subtask PHC-155). Owner: Huy.
 * Fills #page-root on staff/bookings.html: paid, confirmed bookings with a "Mark as completed" button,
 * and the bookings already completed (with the customer's review once there is one).
 * Load after: data.js, store.js, ui.js, review-rules.js. The rules live in PHCReview.
 */
(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;
  var message = "";

  function formatPickup(iso) {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function customerName(id) {
    var c = (PHCStore.get("customers") || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "Unknown customer";
  }

  function row(b) {
    var action;
    if (PHCReview.isCompleted(b)) {
      action = PHCReview.hasReview(b)
        ? "Reviewed: " + PHCReview.RATED.map(function (k) { return b.review[k]; }).join(" / ") + " stars"
        : "Waiting for the customer's review";
    } else {
      action = '<button type="button" class="btn btn-primary btn-sm" data-complete="' + esc(b.id) + '" id="complete-' + esc(b.id) + '">Mark as completed</button>';
    }
    return (
      "<tr data-id=\"" + esc(b.id) + "\">" +
        "<td>" + esc(customerName(b.customerId)) + "</td>" +
        "<td>" + esc(b.serviceName) + " to " + esc(b.destination) + "</td>" +
        "<td>" + esc(formatPickup(b.pickupAt)) + "</td>" +
        '<td><span class="badge ' + (PHCReview.isCompleted(b) ? "badge-available" : "badge-accent") + '">' +
          (PHCReview.isCompleted(b) ? "Completed" : "Confirmed") + "</span></td>" +
        "<td>" + action + "</td>" +
      "</tr>"
    );
  }

  function render() {
    var list = (PHCStore.get("bookings") || [])
      .filter(function (b) { return PHCReview.canMarkCompleted(b) || PHCReview.isCompleted(b); })
      .sort(function (a, b) { return new Date(a.pickupAt) - new Date(b.pickupAt); });
    root.innerHTML =
      '<div id="staff-bookings-status" class="success" role="status" aria-live="polite">' + esc(message) + "</div>" +
      (list.length
        ? '<div class="table-wrap"><table><thead><tr><th scope="col">Customer</th><th scope="col">Journey</th>' +
            '<th scope="col">Pick-up</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>' +
            list.map(row).join("") + "</tbody></table></div>"
        : "<p>There are no paid bookings to complete yet.</p>");
  }

  root.addEventListener("click", function (e) {
    var button = e.target.closest("button[data-complete]");
    if (!button) return;
    var id = button.getAttribute("data-complete");
    var found = (PHCStore.get("bookings") || []).filter(function (b) { return b.id === id; })[0];
    var result = PHCReview.markCompleted(found, new Date());
    if (!result.ok) {
      message = "";
      render();
      root.querySelector("#staff-bookings-status").textContent = result.error;
      return;
    }
    PHCStore.update("bookings", function (list) {
      return (list || []).map(function (b) { return b.id === id ? result.booking : b; });
    });
    message = "Marked as completed. The customer can now leave a review.";
    render();
  });

  document.addEventListener("phc:session-change", render);
  document.addEventListener("phc:reset", function () { message = ""; render(); });

  render();
})();
