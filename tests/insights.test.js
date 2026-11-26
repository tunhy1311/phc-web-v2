(function() {
    "use strict";

    var test = PHCTest.test;
    var equal = PHCTest.equal;
    var I = PHCInsights;

    function booking(changes) {
        var item = {
            id: "b1",
            customerId: "c1",
            pickupAt: "2026-11-20T10:00:00",
            status: "confirmed",
            carModel: "Toyota Prius",
            total: 99,
            payment: { amount: 40 }
        };

        Object.keys(changes || {}).forEach(function(key) {
            item[key] = changes[key];
        });

        return item;
    }

    function customer(id, name) {
        return { id: id, name: name };
    }

    test("insights: ranks the five most-booked car models", function() {
        var list = [];

        function add(model, count) {
            for (var i = 0; i < count; i += 1) {
                list.push(booking({
                    id: model + i,
                    carModel: model
                }));
            }
        }

        add("Toyota Prius", 6);
        add("Ford Galaxy", 5);
        add("Kia Niro", 4);
        add("Mercedes E-Class", 3);
        add("Skoda Octavia", 2);
        add("Volkswagen Sharan", 1);

        var result = I.calculateInsights(list, [], []);

        equal(result.cars.length, 5);
        equal(result.cars[0].name, "Toyota Prius");
        equal(result.cars[0].bookings, 6);
        equal(result.cars[4].name, "Skoda Octavia");
    });

    test("insights: uses the recorded payment amount after an amendment", function() {
        var result = I.calculateInsights([
            booking({ id: "b1", total: 99, payment: { amount: 40 } }),
            booking({ id: "b2", total: 60, payment: { amount: 60 } })
        ], [], [customer("c1", "Sarah Jones")]);

        equal(result.customers[0].bookings, 2);
        equal(result.customers[0].spend, 100);
    });

    test("insights: includes bookings inside the selected date range", function() {
        equal(
            I.isIncluded(
                booking({ pickupAt: "2026-11-20T10:00:00" }),
                "2026-11-01",
                "2026-11-30"
            ),
            true
        );

        equal(
            I.isIncluded(
                booking({ pickupAt: "2026-12-01T10:00:00" }),
                "2026-11-01",
                "2026-11-30"
            ),
            false
        );
    });

    test("insights: excludes cancelled and unpaid bookings", function() {
        equal(
            I.isIncluded(booking({ status: "cancelled" }), "2026-11-01", "2026-11-30"),
            false
        );

        equal(
            I.isIncluded(booking({ status: "unpaid" }), "2026-11-01", "2026-11-30"),
            false
        );
    });

    test("insights: returns empty lists when there are no eligible bookings", function() {
        var result = I.calculateInsights([], [], []);

        equal(result.cars.length, 0);
        equal(result.customers.length, 0);
    });
})();