/*
 * US16 - Staff enquiries inbox: reply and send emails (PHC-14). Owner: Huy.
 * Fills #page-root on staff/enquiries.html.
 * Load after: data.js, store.js, ui.js, validators.js, enquiry-rules.js. All rules live in PHCEnquiry.
 *
 * Acceptance criteria of PHC-14:
 *   Inbox: open enquiries with customer name, type and date (answered ones are listed below).
 *   Open an enquiry, type a reply, Send: the reply is saved and the status becomes 'Answered'.
 *   Empty reply: 'Enter a reply' and nothing is saved.
 *   New email: choose a customer and send; the email appears in that customer's history (My enquiries).
 *   The customer sees the staff reply in My enquiries (customer/my-enquiries.html, US03).
 * The prototype sends no real email: the screen says the message is saved in the customer's history.
 * Typed text is kept when another tab changes the shared state (the list refreshes only when no form is open).
 */
(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;
  var esc = PHCUI.escapeHtml;

  var view = "list";      // "list" | "detail" | "email"
  var openRef = "";       // reference of the enquiry shown in the detail view
  var notice = "";        // success message shown above the list
  var replyDraft = "";
  var emailDraft = { customerId: "", message: "" };

  function enquiries() { return PHCStore.get("enquiries") || []; }
  function customers() { return PHCStore.get("customers") || []; }

  function formatDate(iso) {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function find(ref) {
    return enquiries().filter(function (e) { return e.reference === ref; })[0] || null;
  }

  function saveEnquiry(updated) {
    PHCStore.update("enquiries", function (list) {
      return (list || []).map(function (e) { return e.reference === updated.reference ? updated : e; });
    });
  }

  function badge(e) {
    var label = PHCEnquiry.statusLabel(e);
    return '<span class="badge ' + (label === "Answered" ? "badge-available" : "badge-accent") + '">' + label + "</span>";
  }

  // ---------- list ----------

  function table(list, caption) {
    var cust = customers();
    if (!list.length) return "";
    return (
      '<div class="table-wrap"><table aria-label="' + esc(caption) + '"><thead><tr>' +
        '<th scope="col">Reference</th><th scope="col">Customer</th><th scope="col">Type</th>' +
        '<th scope="col">Date</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Action</span></th>' +
      "</tr></thead><tbody>" +
      list.map(function (e) {
        return (
          '<tr data-ref="' + esc(e.reference) + '">' +
            "<td>" + esc(e.reference) + "</td>" +
            "<td>" + esc(PHCEnquiry.customerName(e, cust)) + "</td>" +
            "<td>" + esc(PHCEnquiry.typeLabel(e)) + "</td>" +
            "<td>" + esc(formatDate(e.createdAt)) + "</td>" +
            "<td>" + badge(e) + "</td>" +
            '<td><button type="button" class="btn btn-ghost btn-sm" data-open="' + esc(e.reference) + '">Open</button></td>' +
          "</tr>"
        );
      }).join("") + "</tbody></table></div>"
    );
  }

  function renderList() {
    view = "list";
    var all = enquiries();
    var open = PHCEnquiry.inbox(all);
    var done = PHCEnquiry.answered(all);
    root.innerHTML =
      '<div id="inbox-status" class="success" role="status" aria-live="polite">' + esc(notice) + "</div>" +
      '<p class="actions"><button type="button" class="btn btn-primary" id="new-email-btn">New email</button></p>' +
      '<section class="card stack" aria-labelledby="open-h"><h2 id="open-h">Open enquiries (' + open.length + ")</h2>" +
        (open.length ? table(open, "Open enquiries") : '<p id="inbox-empty">There are no open enquiries.</p>') +
      "</section>" +
      (done.length
        ? '<section class="card stack" aria-labelledby="done-h"><h2 id="done-h">Answered (' + done.length + ")</h2>" + table(done, "Answered enquiries") + "</section>"
        : "");
    notice = "";
  }

  // ---------- detail and reply ----------

  function repliesHtml(e) {
    return (Array.isArray(e.replies) ? e.replies : []).map(function (r) {
      return (
        '<div class="enquiry-reply"><p class="muted">Reply from PrivateHire Cars, ' + esc(formatDate(r.sentAt)) + "</p>" +
        "<p>" + esc(r.message) + "</p></div>"
      );
    }).join("");
  }

  function renderDetail(e, error) {
    view = "detail";
    openRef = e.reference;
    var cust = customers();
    var booking = e.bookingId
      ? (PHCStore.get("bookings") || []).filter(function (b) { return b.id === e.bookingId; })[0] : null;
    root.innerHTML =
      '<article class="card stack" id="enquiry-detail" aria-label="Enquiry ' + esc(e.reference) + '">' +
        '<div class="enquiry-head"><h2>' + esc(e.reference) + "</h2>" + badge(e) + "</div>" +
        '<dl class="summary-list">' +
          "<div><dt>Customer</dt><dd>" + esc(PHCEnquiry.customerName(e, cust)) + "</dd></div>" +
          (e.email ? "<div><dt>Email</dt><dd>" + esc(e.email) + "</dd></div>" : "") +
          "<div><dt>Type</dt><dd>" + esc(PHCEnquiry.typeLabel(e)) + "</dd></div>" +
          (e.type === "booking" ? "<div><dt>Booking</dt><dd>" + esc(PHCEnquiry.bookingLabel(booking)) + "</dd></div>" : "") +
          "<div><dt>Sent</dt><dd>" + esc(formatDate(e.createdAt)) + "</dd></div>" +
        "</dl>" +
        '<p class="enquiry-message">' + esc(e.message) + "</p>" +
        repliesHtml(e) +
        '<form id="reply-form" class="form" novalidate aria-label="Reply">' +
          '<div class="field"><label for="reply-text">Your reply</label>' +
            '<textarea id="reply-text" name="reply" rows="4"' + (error ? ' aria-invalid="true" aria-describedby="reply-error"' : "") + ">" + esc(replyDraft) + "</textarea>" +
            '<p class="error" id="reply-error" role="alert">' + esc(error || "") + "</p></div>" +
          '<div class="actions"><button type="submit" class="btn btn-primary">Send reply</button>' +
          '<button type="button" class="btn btn-ghost" id="back-btn">Back to inbox</button></div>' +
        "</form>" +
      "</article>";
    root.querySelector("#reply-text").addEventListener("input", function (ev) { replyDraft = ev.target.value; });
    root.querySelector("#back-btn").addEventListener("click", function () { replyDraft = ""; renderList(); });
    root.querySelector("#reply-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      sendReply();
    });
  }

  function sendReply() {
    var current = find(openRef);
    var result = PHCEnquiry.addReply(current, replyDraft, new Date());
    if (!result.ok) {
      var box = root.querySelector("#reply-error");
      var field = root.querySelector("#reply-text");
      if (box) box.textContent = result.error;
      if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
      return;
    }
    saveEnquiry(result.enquiry);
    notice = "Reply sent. " + result.enquiry.reference + " is now Answered and the customer can see it in My enquiries.";
    replyDraft = "";
    renderList();
  }

  // ---------- new email ----------

  function renderEmail(errors) {
    view = "email";
    errors = errors || {};
    var options = '<option value="">Choose a customer</option>' + customers().map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === emailDraft.customerId ? " selected" : "") + ">" +
        esc(c.name) + " (" + esc(c.email) + ")</option>";
    }).join("");
    root.innerHTML =
      '<section class="card stack" aria-labelledby="email-h"><h2 id="email-h">New email</h2>' +
        '<form id="email-form" class="form" novalidate aria-label="New email">' +
          '<div class="field"><label for="email-customer">Customer</label>' +
            '<select id="email-customer" name="customerId">' + options + "</select>" +
            '<p class="error" id="email-customer-error" role="alert">' + esc(errors.customerId || "") + "</p></div>" +
          '<div class="field"><label for="email-text">Email text</label>' +
            '<textarea id="email-text" name="message" rows="5">' + esc(emailDraft.message) + "</textarea>" +
            '<p class="error" id="email-text-error" role="alert">' + esc(errors.message || "") + "</p></div>" +
          '<p class="muted">Prototype: no real email is sent. The email is saved in the customer\'s history.</p>' +
          '<div class="actions"><button type="submit" class="btn btn-primary">Send email</button>' +
          '<button type="button" class="btn btn-ghost" id="back-btn">Back to inbox</button></div>' +
        "</form></section>";
    var form = root.querySelector("#email-form");
    form.elements.customerId.addEventListener("change", function (ev) { emailDraft.customerId = ev.target.value; });
    form.elements.message.addEventListener("input", function (ev) { emailDraft.message = ev.target.value; });
    root.querySelector("#back-btn").addEventListener("click", function () { renderList(); });
    form.addEventListener("submit", function (ev) { ev.preventDefault(); sendEmail(); });
  }

  function sendEmail() {
    var ids = customers().map(function (c) { return c.id; });
    var result = PHCEnquiry.createEmail(emailDraft, enquiries(), ids, new Date());
    if (!result.ok) return renderEmail(result.errors);
    PHCStore.update("enquiries", function (list) { return (list || []).concat([result.enquiry]); });
    var name = (customers().filter(function (c) { return c.id === result.enquiry.customerId; })[0] || {}).name || "the customer";
    notice = "Email sent to " + name + ". It is saved as " + result.enquiry.reference + " in their history.";
    emailDraft = { customerId: "", message: "" };
    renderList();
  }

  // ---------- events ----------

  root.addEventListener("click", function (e) {
    var openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      var found = find(openBtn.getAttribute("data-open"));
      if (found) { replyDraft = ""; renderDetail(found); root.querySelector("#reply-text").focus(); }
      return;
    }
    if (e.target.closest("#new-email-btn")) {
      emailDraft = { customerId: "", message: "" };
      renderEmail();
    }
  });

  // Another tab changed the shared state: refresh the list, but never throw away a reply being typed.
  document.addEventListener("phc:session-change", function () { if (view === "list") renderList(); });
  document.addEventListener("phc:reset", function () {
    replyDraft = ""; emailDraft = { customerId: "", message: "" }; notice = ""; renderList();
  });

  renderList();
})();
