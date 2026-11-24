(function () {
  "use strict";

  var root = document.getElementById("page-root");
  var esc = PHCUI.escapeHtml;
  var bookingId = new URLSearchParams(window.location.search).get("booking") || "";
  var back = "payment.html?booking=" + encodeURIComponent(bookingId);

  function findBooking() {
    return (PHCStore.get("bookings") || []).filter(function (b) { return b.id === bookingId; })[0] || null;
  }

  function render() {
    var booking = findBooking();
    if (!PHCPayment.canPay(booking, PHCStore.session()).ok) {
      root.innerHTML =
        '<div class="card">' +
          "<h2>Nothing to pay</h2>" +
          "<p>This booking cannot be paid with PayPal right now.</p>" +
          '<div class="actions"><a class="btn btn-primary" href="' + esc(back) + '">Back to payment</a></div>' +
        "</div>";
      return;
    }

    root.innerHTML =
      '<div class="card paypal-box">' +
        '<p class="paypal-mark">PayPal</p>' +
        '<p class="hint-box">Simulated for this prototype. No real money moves.</p>' +
        '<dl class="summary-list">' +
          "<div><dt>Pay to</dt><dd>PrivateHire Cars</dd></div>" +
          "<div><dt>Booking reference</dt><dd>" + esc(booking.id.toUpperCase()) + "</dd></div>" +
          '<div class="total"><dt>Amount</dt><dd>£' + Number(booking.total).toFixed(2) + "</dd></div>" +
        "</dl>" +
        '<div class="actions">' +
          '<button type="button" class="btn btn-primary" id="pp-pay">Pay now</button>' +
          '<button type="button" class="btn btn-ghost" id="pp-cancel">Cancel and return</button>' +
        "</div>" +
      "</div>";

    root.querySelector("#pp-pay").addEventListener("click", function () {
      var current = findBooking();
      if (PHCPayment.canPay(current, PHCStore.session()).ok) {
        var paid = PHCPayment.markPaid(current, {
          method: "paypal",
          paidAt: new Date().toISOString(),
          reference: PHCPayment.newReference()
        });
        PHCStore.update("bookings", function (list) {
          return (list || []).map(function (b) { return b.id === paid.id ? paid : b; });
        });
      }
      window.location.replace(back + "&paypal=success");
    });

    root.querySelector("#pp-cancel").addEventListener("click", function () {
      window.location.replace(back + "&paypal=cancel");
    });
  }

  render();
})();
