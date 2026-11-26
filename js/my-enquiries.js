/*
 * US03 - My enquiries (PHC-18). Owner: Phúc Nguyễn.
 * Fills #page-root on customer/my-enquiries.html: the signed-in customer's enquiries, newest first,
 * each with its reference, type, booking, date, status ('Open' / 'Answered') and any staff replies
 * (replies are added by US16 PHC-14, see the enquiries record in js/store.js).
 * Load after: data.js, store.js, ui.js, validators.js, auth.js, enquiry-rules.js.
 */
(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;

  function formatDate(iso) {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function bookingById(id) {
    return (PHCStore.get("bookings") || []).filter(function (b) { return b.id === id; })[0] || null;
  }

  function replyHtml(r) {
    return (
      '<div class="enquiry-reply">' +
        '<p class="muted">Reply from PrivateHire Cars, ' + esc(formatDate(r.sentAt)) + "</p>" +
        "<p>" + esc(r.message) + "</p>" +
      "</div>"
    );
  }

  function enquiryCard(e) {
    var status = PHCEnquiry.statusLabel(e);
    var replies = Array.isArray(e.replies) ? e.replies : [];
    return (
      '<article class="card" data-ref="' + esc(e.reference) + '" aria-label="Enquiry ' + esc(e.reference) + '">' +
        '<div class="enquiry-head">' +
          "<h2>" + esc(e.reference) + "</h2>" +
          '<span class="badge ' + (status === "Answered" ? "badge-available" : "badge-accent") + '">' + status + "</span>" +
        "</div>" +
        '<dl class="summary-list">' +
          "<div><dt>Type</dt><dd>" + esc(PHCEnquiry.TYPES[e.type] || e.type) + "</dd></div>" +
          (e.type === "booking" ? "<div><dt>Booking</dt><dd>" + esc(PHCEnquiry.bookingLabel(bookingById(e.bookingId))) + "</dd></div>" : "") +
          "<div><dt>Sent</dt><dd>" + esc(formatDate(e.createdAt)) + "</dd></div>" +
        "</dl>" +
        '<p class="enquiry-message">' + esc(e.message) + "</p>" +
        replies.map(replyHtml).join("") +
      "</article>"
    );
  }

  function render() {
    var customer = PHCAuth.requireCustomer("my-enquiries.html");
    if (!customer) return;
    var list = PHCEnquiry.forCustomer(PHCStore.get("enquiries") || [], customer.id);
    root.innerHTML = list.length
      ? '<div class="stack">' + list.map(enquiryCard).join("") + "</div>"
      : '<div class="card"><p>You have not sent any enquiries yet.</p>' +
          '<p><a class="btn btn-primary" href="enquiry.html">Send an enquiry</a></p></div>';
  }

  document.addEventListener("phc:session-change", render);
  document.addEventListener("phc:reset", render);

  render();
})();
