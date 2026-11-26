/*
 * PrivateHire Cars (PHC) - sample data.
 * PHCStore copies this into localStorage ("phc-state-v1") on first run
 * and again whenever "Reset sample data" is pressed.
 * Do not rename keys: the whole team codes against this contract.
 */
var PHC_DATA = {
  services: [
    {
      id: "local",
      name: "Local journey",
      description: "Short trips within London, door to door.",
      fromPrice: 12,
      needsFlight: false,
      byTime: false
    },
    {
      id: "long-distance",
      name: "Long distance journey",
      description: "Comfortable travel from London to anywhere in the UK.",
      fromPrice: 90,
      needsFlight: false,
      byTime: false
    },
    {
      id: "airport",
      name: "Airport transfer",
      description: "To or from Heathrow, Gatwick, Stansted, Luton and City airports.",
      fromPrice: 45,
      needsFlight: true,
      byTime: false
    },
    {
      id: "hotel",
      name: "Hotel transfer",
      description: "Pick-up and drop-off at London hotels.",
      fromPrice: 20,
      needsFlight: false,
      byTime: false
    },
    {
      id: "meet-greet",
      name: "Meet & greet at airport",
      description: "Your driver waits in arrivals with a name board.",
      fromPrice: 60,
      needsFlight: true,
      byTime: false
    },
    {
      id: "daily-hire",
      name: "Driver & car daily hire",
      description: "A car and driver at your disposal, charged by the hour.",
      fromPrice: 35,
      needsFlight: false,
      byTime: true
    }
  ],

  customers: [
    {
      id: "c1",
      name: "Sarah Jones",
      email: "sarah@example.com",
      phone: "07123 456789",
      address: "1 High St",
      postcode: "E1 6AN",
      dob: "1990-04-15",
      password: "demo1234", // prototype only: never store plain passwords in a real system
      card: { brand: "Visa", last4: "4242" },
      bookings: []
    }
  ],

  // Sample journey that has already taken place (paid, confirmed, pick-up in the past) so that staff can
  // mark it Completed and the customer can leave a review during the demo (PHC-9 / US11).
  bookings: [
    {
      id: "bkdemo1",
      customerId: "c1",
      serviceId: "airport",
      serviceName: "Airport transfer",
      flight: "BA117",
      hours: null,
      pickup: "1 High St, London E1 6AN",
      destination: "Heathrow Airport, Terminal 5",
      pickupAt: "2026-11-20T09:30:00",
      passengers: 2,
      carSize: 4,
      baseFare: 45,
      discount: 6.75,
      total: 38.25,
      channel: "online",
      tag: "Priority",
      status: "confirmed",
      createdAt: "2026-11-18T10:00:00.000Z",
      payment: { method: "card", brand: "Visa", last4: "4242", paidAt: "2026-11-18T10:05:00.000Z", reference: "PAY-DEMO01", amount: 38.25 }
    }
  ],

  drivers: [
    { id: "d1", name: "James Carter", phone: "07700 900101" },
    { id: "d2", name: "Amira Hassan", phone: "07700 900102" },
    { id: "d3", name: "Tom Wilson", phone: "07700 900103" },
    { id: "d4", name: "Priya Patel", phone: "07700 900104" },
    { id: "d5", name: "Daniel Okafor", phone: "07700 900105" },
    { id: "d6", name: "Emma Clarke", phone: "07700 900106" },
    { id: "d7", name: "Lukas Nowak", phone: "07700 900107" },
    { id: "d8", name: "Grace Lee", phone: "07700 900108" }
  ],

  // size = number of passenger seats (4 or 7)
  cars: [
    { id: "car1", registration: "LB19 XKT", make: "Toyota Prius", colour: "Black", size: 4, status: "available", driverId: "d1" },
    { id: "car2", registration: "LD20 MVR", make: "Mercedes E-Class", colour: "Silver", size: 4, status: "busy", driverId: "d2" },
    { id: "car3", registration: "LF21 PZA", make: "Skoda Octavia", colour: "Grey", size: 4, status: "available", driverId: "d3" },
    { id: "car4", registration: "LG68 HTN", make: "Kia Niro", colour: "White", size: 4, status: "busy", driverId: "d4" },
    { id: "car5", registration: "LK70 BWE", make: "Ford Galaxy", colour: "Blue", size: 7, status: "available", driverId: "d5" },
    { id: "car6", registration: "LM22 RJC", make: "Volkswagen Sharan", colour: "Black", size: 7, status: "busy", driverId: "d6" },
    { id: "car7", registration: "LN19 DSU", make: "Mercedes V-Class", colour: "Black", size: 7, status: "available", driverId: "d7" },
    { id: "car8", registration: "LR71 FYO", make: "Toyota Corolla", colour: "Red", size: 4, status: "available", driverId: "d8" }
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PHC_DATA;
}
