(function() {
    "use strict";

    var form = document.getElementById("register-form");
    var pageRoot = document.getElementById("page-root");

    if (!form || !pageRoot) return;

    function getInput(id) {
        return document.getElementById(id);
    }

    function value(id) {
        return getInput(id).value.trim();
    }

    function setError(id, message) {
        PHCUI.setFieldError(getInput(id), message);
    }

    function clearErrors() {
        ["name", "email", "address", "phone", "password", "card-number"].forEach(function(id) {
            PHCUI.clearFieldError(getInput(id));
        });
    }

    function cardBrand(cardNumber) {
        var digits = cardNumber.replace(/\D/g, "");

        if (/^4/.test(digits)) return "Visa";
        if (/^5[1-5]/.test(digits)) return "Mastercard";
        if (/^3[47]/.test(digits)) return "American Express";

        return "Card";
    }

    function showConfirmation(customer) {
        pageRoot.className = "card";
        pageRoot.innerHTML =
            '<h2 class="success">Account created</h2>' +
            "<p>Welcome, " + PHCUI.escapeHtml(customer.name) + ".</p>" +
            '<p>A confirmation email has been sent to <strong>' +
            PHCUI.escapeHtml(customer.email) +
            "</strong>.</p>" +
            '<p class="muted">Saved card: ' +
            PHCUI.escapeHtml(customer.card.brand) +
            " ending in " +
            PHCUI.escapeHtml(customer.card.last4) +
            ".</p>" +
            '<div class="actions">' +
            '<a class="btn btn-primary" href="book.html">Book a car</a>' +
            "</div>";
    }

    form.addEventListener("submit", function(event) {
        event.preventDefault();
        clearErrors();

        var valid = true;
        var name = value("name");
        var email = value("email").toLowerCase();
        var address = value("address");
        var phone = value("phone");
        var password = value("password");
        var cardNumber = value("card-number");

        if (!name) {
            setError("name", "Enter your full name.");
            valid = false;
        }

        if (!PHCValidate.email(email)) {
            setError("email", "Enter a valid email address.");
            valid = false;
        }

        if (!address) {
            setError("address", "Enter your address.");
            valid = false;
        }

        if (!PHCValidate.phone(phone)) {
            setError("phone", "Enter a valid UK phone number.");
            valid = false;
        }

        if (password.length < 8) {
            setError("password", "Password must contain at least 8 characters.");
            valid = false;
        }

        if (!PHCValidate.luhn(cardNumber)) {
            setError("card-number", "Enter a valid card number.");
            valid = false;
        }

        var customers = PHCStore.get("customers") || [];
        var emailExists = customers.some(function(customer) {
            return customer.email.toLowerCase() === email;
        });

        if (emailExists) {
            setError("email", "An account with this email already exists. Please sign in.");
            valid = false;
        }

        if (!valid) return;

        var cardDigits = cardNumber.replace(/\D/g, "");
        var customer = {
            id: "c" + Date.now(),
            name: name,
            email: email,
            address: address,
            phone: phone,
            password: password,
            card: {
                brand: cardBrand(cardNumber),
                last4: cardDigits.slice(-4)
            },
            bookings: []
        };

        customers.push(customer);
        PHCStore.set("customers", customers);
        PHCStore.setSession({ role: "customer", id: customer.id });
        PHCUI.renderHeader();

        showConfirmation(customer);
    });
})();