/*
 * US11 - Leave a review (PHC-9). Owner: Huy.
 * Fills #page-root on customer/review.html?booking=<id>.
 * Load after: data.js, store.js, ui.js, validators.js, auth.js, review-rules.js.
 *
 * Only the signed-in customer's own completed booking can be reviewed. The rules (three ratings from
 * 1 to 5, no second review) live in PHCReview; this file draws the form and saves with PHCStore.
 * The page checks the session again every time the shared state changes (phc:session-change).
 */
(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;
  var LABELS = { journey: "Journey", minicab: "Minicab", driver: "Driver" };
  var bookingId = new URLSearchParams(window.location.search).get("booking") || "";
  var draft = { journey: "", minicab: "", driver: "", comment: "" };
  var errorText = "";

  function formatPickup(iso) {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function findBooking(customer) {
    return (PHCStore.get("bookings") || []).filter(function (b) {
      return b.id === bookingId && b.customerId === customer.id;
    })[0] || null;
  }

  function backLink() {
    return '<p><a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">Back to My bookings</a></p>';
  }

  function summary(b) {
    return (
      '<dl class="summary-list">' +
        "<div><dt>Booking</dt><dd>" + esc(b.serviceName) + " to " + esc(b.destination) + "</dd></div>" +
        "<div><dt>Pick-up time</dt><dd>" + esc(formatPickup(b.pickupAt)) + "</dd></div>" +
      "</dl>"
    );
  }

  function ratingsHtml(review) {
    return (
      '<div class="review-summary" id="review-saved">' +
        PHCReview.RATED.map(function (key) {
          return "<p><strong>" + LABELS[key] + ":</strong> " +
            '<span class="star-text" aria-hidden="true">' + PHCReview.stars(review[key]) + "</span> " +
            esc(String(review[key])) + " out of 5</p>";
        }).join("") +
        (review.comment ? "<p><strong>Your comment:</strong> " + esc(review.comment) + "</p>" : "") +
      "</div>"
    );
  }

  function starGroup(key) {
    var inputs = [1, 2, 3, 4, 5].map(function (n) {
      var checked = String(draft[key]) === String(n);
      return (
        '<label class="star-choice' + (checked ? " selected" : "") + '">' +
          '<input type="radio" name="' + key + '" value="' + n + '"' + (checked ? " checked" : "") + ">" +
          "<span>" + n + ' <span class="star-text" aria-hidden="true">★</span>' +
          '<span class="sr-only"> star' + (n === 1 ? "" : "s") + "</span></span>" +
        "</label>"
      );
    }).join("");
    return (
      '<fieldset class="rating-group" id="rate-' + key + '"><legend>' + LABELS[key] + " rating</legend>" +
        '<div class="stars">' + inputs + "</div></fieldset>"
    );
  }

  function renderForm(b) {
    root.innerHTML =
      '<div class="card stack">' + summary(b) +
        '<form id="review-form" class="form" novalidate aria-label="Review form">' +
          PHCReview.RATED.map(starGroup).join("") +
          '<div class="field"><label for="review-comment">Comment (optional)</label>' +
            '<textarea id="review-comment" name="comment" rows="4">' + esc(draft.comment) + "</textarea></div>" +
          '<p class="error" id="review-error" role="alert">' + esc(errorText) + "</p>" +
          '<div class="actions"><button type="submit" class="btn btn-primary">Submit review</button>' +
          '<a class="btn btn-ghost" href="' + esc(PHCUI.url("customer/my-bookings.html")) + '">Cancel</a></div>' +
        "</form>" +
      "</div>";
    var form = root.querySelector("#review-form");
    form.addEventListener("change", function (e) {
      if (e.target && e.target.type === "radio") draft[e.target.name] = e.target.value;
      Array.prototype.forEach.call(form.querySelectorAll(".star-choice"), function (l) {
        l.classList.toggle("selected", l.querySelector("input").checked);
      });
    });
    form.addEventListener("input", function (e) {
      if (e.target && e.target.name === "comment") draft.comment = e.target.value;
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit();
    });
  }

  function submit() {
    var customer = PHCAuth.currentCustomer();
    var b = customer ? findBooking(customer) : null;
    if (!b) return render();
    var result = PHCReview.submitReview(b, draft, new Date());
    if (!result.ok) {
      errorText = result.error;
      var box = root.querySelector("#review-error");
      if (box) box.textContent = errorText;
      return;
    }
    PHCStore.update("bookings", function (list) {
      return (list || []).map(function (x) { return x.id === result.booking.id ? result.booking : x; });
    });
    errorText = "";
    render("Thank you, your review has been saved.");
  }

  function render(message) {
    var customer = PHCAuth.requireCustomer("review.html?booking=" + encodeURIComponent(bookingId));
    if (!customer) return;
    var b = findBooking(customer);
    if (!b) {
      root.innerHTML = '<div class="card"><p class="error" role="alert">We could not find that booking.</p>' + backLink() + "</div>";
      return;
    }
    if (PHCReview.hasReview(b)) {
      root.innerHTML =
        '<div class="card stack">' + summary(b) +
          (message ? '<p class="success" role="status">' + esc(message) + "</p>" : '<p class="muted">You have already reviewed this booking.</p>') +
          ratingsHtml(b.review) + backLink() + "</div>";
      return;
    }
    if (!PHCReview.canReview(b)) {
      root.innerHTML =
        '<div class="card"><p class="error" role="alert">You can review a journey after staff have marked it as completed.</p>' +
        backLink() + "</div>";
      return;
    }
    renderForm(b);
  }

  document.addEventListener("phc:session-change", function () { render(); });
  document.addEventListener("phc:reset", function () { draft = { journey: "", minicab: "", driver: "", comment: "" }; errorText = ""; render(); });

  render();
})();
