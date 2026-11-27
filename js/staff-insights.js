var PHCInsights = (function() {
    "use strict";

    var esc = PHCUI.escapeHtml;

    function money(value) {
        return "£" + Number(value || 0).toFixed(2);
    }

    function dateToInput(date) {
        return date.toISOString().slice(0, 10);
    }

    function bookingDate(booking) {
        var value = booking.pickupAt || booking.createdAt || "";
        return String(value).slice(0, 10);
    }

    function isIncluded(booking, startDate, endDate) {
        var date = bookingDate(booking);

        if (!date) return false;
        if (booking.status === "cancelled" || booking.status === "unpaid") return false;
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;

        return true;
    }

    function getEligibleBookings(startDate, endDate) {
        return (PHCStore.get("bookings") || []).filter(function(booking) {
            return isIncluded(booking, startDate, endDate);
        });
    }

    function carLabel(booking) {
        // Historical rows without a recorded assignment are intentionally excluded.
        // Looking up today's fleet would invent a model for an old booking.
        return booking.carModel ? booking.carModel : null;
    }

    function calculateInsights(bookings, cars, customers) {
        var carStats = {};
        var customerStats = {};

        bookings.forEach(function(booking) {
            var carName = carLabel(booking);

            if (carName) {
                if (!carStats[carName]) {
                    carStats[carName] = { name: carName, bookings: 0 };
                }
                carStats[carName].bookings += 1;
            }

            var customer = customers.filter(function(item) {
                return item.id === booking.customerId;
            })[0];

            var customerId = booking.customerId || "unknown";
            var customerName = customer ?
                customer.name :
                (booking.customerName || "Unknown customer");

            if (!customerStats[customerId]) {
                customerStats[customerId] = {
                    id: customerId,
                    name: customerName,
                    bookings: 0,
                    spend: 0
                };
            }

            customerStats[customerId].bookings += 1;
            customerStats[customerId].spend += Number(
                booking.payment && booking.payment.amount || 0
            );
        });

        var carsList = Object.keys(carStats).map(function(key) {
            return carStats[key];
        });

        carsList.sort(function(a, b) {
            return b.bookings - a.bookings || a.name.localeCompare(b.name);
        });

        var customersList = Object.keys(customerStats).map(function(key) {
            return customerStats[key];
        });

        customersList.sort(function(a, b) {
            return b.bookings - a.bookings ||
                b.spend - a.spend ||
                a.name.localeCompare(b.name);
        });

        return {
            cars: carsList.slice(0, 5),
            customers: customersList
        };
    }

    function renderCars(cars) {
        var rows = document.getElementById("car-insights-rows");
        var empty = document.getElementById("car-empty");

        rows.innerHTML = "";

        if (!cars.length) {
            empty.hidden = false;
            return;
        }

        empty.hidden = true;

        cars.forEach(function(car, index) {
            rows.innerHTML +=
                "<tr>" +
                "<td>" + (index + 1) + "</td>" +
                "<td>" + esc(car.name) + "</td>" +
                "<td>" + car.bookings + "</td>" +
                "</tr>";
        });
    }

    function renderCustomers(customers) {
        var rows = document.getElementById("customer-insights-rows");
        var empty = document.getElementById("customer-empty");

        rows.innerHTML = "";

        if (!customers.length) {
            empty.hidden = false;
            return;
        }

        empty.hidden = true;

        customers.forEach(function(customer) {
            rows.innerHTML +=
                "<tr>" +
                "<td>" + esc(customer.name) + "</td>" +
                "<td>" + customer.bookings + "</td>" +
                "<td>" + money(customer.spend) + "</td>" +
                '<td><button type="button" class="btn btn-ghost btn-sm" ' +
                'data-customer-id="' + esc(customer.id) + '">' +
                "View history" +
                "</button></td>" +
                "</tr>";
        });

        Array.prototype.forEach.call(
            rows.querySelectorAll("[data-customer-id]"),
            function(button) {
                button.addEventListener("click", function() {
                    showCustomerHistory(button.getAttribute("data-customer-id"));
                });
            }
        );
    }

    function showCustomerHistory(customerId) {
        var customers = PHCStore.get("customers") || [];
        var bookings = PHCStore.get("bookings") || [];
        var customer = customers.filter(function(item) {
            return item.id === customerId;
        })[0];

        var history = bookings.filter(function(booking) {
            return booking.customerId === customerId;
        });

        var panel = document.getElementById("customer-history");
        var name = customer ? customer.name : "Customer";

        panel.hidden = false;
        panel.innerHTML =
            "<h2>" + esc(name) + " — booking history</h2>" +
            (history.length ?
                '<div class="table-wrap"><table>' +
                "<thead><tr>" +
                "<th>Date</th><th>Service</th><th>Total</th><th>Status</th>" +
                "</tr></thead><tbody>" +
                history.map(function(booking) {
                    return (
                        "<tr>" +
                        "<td>" + esc(bookingDate(booking) || "—") + "</td>" +
                        "<td>" + esc(booking.serviceName || booking.serviceId || "—") + "</td>" +
                        "<td>" + money(booking.total) + "</td>" +
                        "<td>" + esc(booking.status || "—") + "</td>" +
                        "</tr>"
                    );
                }).join("") +
                "</tbody></table></div>" :
                "<p class=\"muted\">No bookings found for this customer.</p>");

        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function render() {
        var startDate = document.getElementById("start-date").value;
        var endDate = document.getElementById("end-date").value;
        var message = document.getElementById("filter-message");

        if (startDate && endDate && startDate > endDate) {
            message.textContent = "Start date must be before end date.";
            renderCars([]);
            renderCustomers([]);
            return;
        }

        var bookings = getEligibleBookings(startDate, endDate);
        var insights = calculateInsights(
            bookings,
            PHCStore.get("cars") || [],
            PHCStore.get("customers") || []
        );

        message.textContent = bookings.length +
            (bookings.length === 1 ? " eligible booking found." : " eligible bookings found.");

        renderCars(insights.cars);
        renderCustomers(insights.customers);
    }

    function init() {
        var startDate = document.getElementById("start-date");
        var endDate = document.getElementById("end-date");
        var form = document.getElementById("insights-filter");

        var today = new Date();
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        startDate.value = dateToInput(thirtyDaysAgo);
        endDate.value = dateToInput(today);

        form.addEventListener("submit", function(event) {
            event.preventDefault();
            render();
        });

        document.addEventListener("phc:reset", render);
        render();
    }

    if (document.getElementById("insights-filter")) {
        init();
    }

    return {
        calculateInsights: calculateInsights,
        isIncluded: isIncluded
    };
})();
