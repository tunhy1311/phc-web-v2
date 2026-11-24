(function () {
  "use strict";

  var root = document.getElementById("page-root");
  if (!root) return;

  function esc(value) {
    return PHCUI.escapeHtml(String(value == null ? "" : value));
  }

  function normalPhone(value) {
    return String(value || "").replace(/[\s\-()]/g, "");
  }

  function customers() {
    return PHCStore.get("customers") || [];
  }

  function bookings() {
    return PHCStore.get("bookings") || [];
  }

  function findCustomer(type, query) {
    var list = customers();
    var wanted = String(query || "").trim();

    if (type === "phone") {
      var phone = normalPhone(wanted);
      return list.filter(function (customer) {
        return normalPhone(customer.phone) === phone;
      })[0] || null;
    }

    if (type === "email") {
      var email = wanted.toLowerCase();
      return list.filter(function (customer) {
        return String(customer.email || "").toLowerCase() === email;
      })[0] || null;
    }

    var reference = wanted.toLowerCase();
    var booking = bookings().filter(function (item) {
      return [item.id, item.reference, item.bookingReference].some(function (value) {
        return String(value || "").toLowerCase() === reference;
      });
    })[0];

    if (!booking) return null;
    return list.filter(function (customer) {
      return customer.id === booking.customerId;
    })[0] || null;
  }

  root.innerHTML =
    '<form id="caller-search-form" class="form" novalidate>' +
      '<div class="field">' +
        '<label for="caller-search-type">Search by</label>' +
        '<select id="caller-search-type" name="searchType">' +
          '<option value="phone">Phone number</option>' +
          '<option value="email">Email</option>' +
          '<option value="booking">Booking reference</option>' +
        '</select>' +
      '</div>' +
      '<div class="field">' +
        '<label for="caller-query" id="caller-query-label">Phone number</label>' +
        '<input id="caller-query" name="query" type="tel" placeholder="07123 456789" autocomplete="off">' +
        '<p class="error" id="caller-search-error" role="alert"></p>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="btn btn-primary" type="submit">Search caller</button>' +
      '</div>' +
    '</form>' +
    '<div id="caller-result" aria-live="polite"></div>';

  var searchForm = document.getElementById("caller-search-form");
  var typeInput = document.getElementById("caller-search-type");
  var queryInput = document.getElementById("caller-query");
  var queryLabel = document.getElementById("caller-query-label");
  var searchError = document.getElementById("caller-search-error");
  var result = document.getElementById("caller-result");

  function updateSearchInput() {
    var settings = {
      phone: { label: "Phone number", type: "tel", placeholder: "07123 456789" },
      email: { label: "Email", type: "email", placeholder: "sarah@example.com" },
      booking: { label: "Booking reference", type: "text", placeholder: "b-1001" }
    }[typeInput.value];

    queryLabel.textContent = settings.label;
    queryInput.type = settings.type;
    queryInput.placeholder = settings.placeholder;
    queryInput.value = "";
    searchError.textContent = "";
    result.innerHTML = "";
    queryInput.focus();
  }

  function validateSearch(type, query) {
    if (!query.trim()) return "Enter a search value.";
    if (type === "phone" && !PHCValidate.phone(query)) return "Enter a valid UK phone number.";
    if (type === "email" && !PHCValidate.email(query)) return "Enter a valid email address.";
    if (type === "booking" && !/^[A-Za-z0-9-]{2,}$/.test(query.trim())) {
      return "Enter a valid booking reference.";
    }
    return "";
  }

  function showNoMatch(type, query) {
    result.innerHTML =
      '<section class="card">' +
        '<h2>No matching customer</h2>' +
        '<p>No account was found for this search.</p>' +
        '<button class="btn btn-primary" type="button" id="new-customer">New customer</button>' +
      '</section>';

    document.getElementById("new-customer").addEventListener("click", function () {
      showCreateCustomer(type === "phone" ? query : "");
    });
  }

  function showMatchedCustomer(customer) {
    result.innerHTML =
      '<section class="card">' +
        '<h2>Customer match found</h2>' +
        '<p>Confirm both security answers before opening the account.</p>' +
        '<form id="verification-form" class="form" novalidate>' +
          '<div class="field">' +
            '<label for="verify-postcode">Postcode</label>' +
            '<input id="verify-postcode" name="postcode" autocomplete="postal-code">' +
          '</div>' +
          '<div class="field">' +
            '<label for="verify-dob">Date of birth</label>' +
            '<input id="verify-dob" name="dob" type="date">' +
          '</div>' +
          '<p class="error" id="verification-error" role="alert"></p>' +
          '<div class="actions">' +
            '<button class="btn btn-primary" type="submit">Verify caller</button>' +
          '</div>' +
        '</form>' +
      '</section>';

    document.getElementById("verification-form").addEventListener("submit", function (event) {
      event.preventDefault();
      var postcode = document.getElementById("verify-postcode").value.trim().toUpperCase().replace(/\s/g, "");
      var dob = document.getElementById("verify-dob").value;
      var savedPostcode = String(customer.postcode || "").toUpperCase().replace(/\s/g, "");

      if (postcode === savedPostcode && dob === customer.dob) {
        openAccount(customer, "Caller verified successfully.");
        return;
      }

      document.getElementById("verification-error").textContent =
        "Verification failed. The account remains locked.";
    });
  }

  function showCreateCustomer(prefilledPhone) {
    result.innerHTML =
      '<section class="card">' +
        '<h2>Create new customer</h2>' +
        '<form id="new-customer-form" class="form" novalidate>' +
          '<div class="field"><label for="new-name">Full name</label>' +
            '<input id="new-name" name="name" autocomplete="name"></div>' +
          '<div class="field"><label for="new-email">Email</label>' +
            '<input id="new-email" name="email" type="email" autocomplete="email"></div>' +
          '<div class="field"><label for="new-phone">Phone number</label>' +
            '<input id="new-phone" name="phone" type="tel" autocomplete="tel" value="' + esc(prefilledPhone) + '"></div>' +
          '<div class="field"><label for="new-postcode">Postcode</label>' +
            '<input id="new-postcode" name="postcode" autocomplete="postal-code"></div>' +
          '<div class="field"><label for="new-dob">Date of birth</label>' +
            '<input id="new-dob" name="dob" type="date"></div>' +
          '<p class="error" id="new-customer-error" role="alert"></p>' +
          '<div class="actions"><button class="btn btn-primary" type="submit">Save customer</button></div>' +
        '</form>' +
      '</section>';

    document.getElementById("new-customer-form").addEventListener("submit", saveNewCustomer);
    document.getElementById("new-name").focus();
  }

  function saveNewCustomer(event) {
    event.preventDefault();
    var name = document.getElementById("new-name").value.trim();
    var email = document.getElementById("new-email").value.trim().toLowerCase();
    var phone = document.getElementById("new-phone").value.trim();
    var postcode = document.getElementById("new-postcode").value.trim().toUpperCase();
    var dob = document.getElementById("new-dob").value;
    var error = document.getElementById("new-customer-error");
    var list = customers();

    if (!name) return void (error.textContent = "Enter the customer's name.");
    if (!PHCValidate.email(email)) return void (error.textContent = "Enter a valid email address.");
    if (!PHCValidate.phone(phone)) return void (error.textContent = "Enter a valid UK phone number.");
    if (!PHCValidate.postcode(postcode)) return void (error.textContent = "Enter a valid UK postcode.");
    if (!dob) return void (error.textContent = "Enter the customer's date of birth.");
    if (list.some(function (customer) { return String(customer.email || "").toLowerCase() === email; })) {
      return void (error.textContent = "An account with this email already exists.");
    }

    var customer = {
      id: "c-" + Date.now(),
      name: name,
      email: email,
      phone: phone,
      address: "",
      postcode: postcode,
      dob: dob,
      password: "",
      card: null,
      bookings: []
    };

    list.push(customer);
    PHCStore.set("customers", list);
    openAccount(customer, "New customer account saved.");
  }

  function openAccount(customer, message) {
    PHCStore.set("staffBookingCustomerId", customer.id);
    result.innerHTML =
      '<section class="card">' +
        '<p class="hint-box">' + esc(message) + '</p>' +
        '<h2>Customer account open</h2>' +
        '<dl class="summary-list">' +
          '<div><dt>Name</dt><dd>' + esc(customer.name) + '</dd></div>' +
          '<div><dt>Email</dt><dd>' + esc(customer.email) + '</dd></div>' +
          '<div><dt>Phone</dt><dd>' + esc(customer.phone) + '</dd></div>' +
          '<div><dt>Postcode</dt><dd>' + esc(customer.postcode) + '</dd></div>' +
        '</dl>' +
        '<div class="actions">' +
          '<a class="btn btn-primary" href="' +
            esc(PHCUI.url("staff/new-booking.html") + "?customer=" + encodeURIComponent(customer.id)) +
          '">Start booking</a>' +
        '</div>' +
      '</section>';
  }

  typeInput.addEventListener("change", updateSearchInput);
  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var type = typeInput.value;
    var query = queryInput.value.trim();
    var error = validateSearch(type, query);

    searchError.textContent = error;
    result.innerHTML = "";
    if (error) {
      queryInput.focus();
      return;
    }

    var customer = findCustomer(type, query);
    if (customer) showMatchedCustomer(customer);
    else showNoMatch(type, query);
  });
})();
