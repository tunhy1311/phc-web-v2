/* Shared vehicle availability and assignment rules (US06 / booking / amendments).
 * A normal journey reserves a car for one hour. Daily hire reserves it for its
 * recorded number of hours. Stored endAt/dropoffAt wins when dispatch provides it.
 */
var PHCVehicleAssignment = (function () {
  "use strict";

  var HOUR_MS = 60 * 60 * 1000;

  function time(value) {
    var valueAsTime = new Date(value).getTime();
    return isFinite(valueAsTime) ? valueAsTime : NaN;
  }

  function endTime(booking) {
    var explicitEnd = time(booking && (booking.endAt || booking.dropoffAt));
    if (isFinite(explicitEnd)) return explicitEnd;
    var start = time(booking && booking.pickupAt);
    if (!isFinite(start)) return NaN;
    var hours = booking && booking.serviceId === "daily-hire" ? Number(booking.hours) : 1;
    if (!isFinite(hours) || hours < 1) hours = 1;
    return start + hours * HOUR_MS;
  }

  function hasConflict(car, booking, bookings, excludeBookingId) {
    var start = time(booking && booking.pickupAt);
    var end = endTime(booking);
    if (!car || !isFinite(start) || !isFinite(end) || end <= start) return true;

    return (bookings || []).some(function (other) {
      if (!other || other.id === excludeBookingId || other.status === "cancelled") return false;
      if (other.carId !== car.id && other.vehicleId !== car.id) return false;
      var otherStart = time(other.pickupAt);
      var otherEnd = endTime(other);
      // Adjacent journeys are valid: only intersecting intervals conflict.
      return isFinite(otherStart) && isFinite(otherEnd) && start < otherEnd && end > otherStart;
    });
  }

  function findAvailableCar(booking, cars, bookings, excludeBookingId) {
    var requiredSeats = Math.max(Number(booking && booking.carSize) || 0,
      Number(booking && booking.passengers) || 0);
    if (!requiredSeats || !isFinite(time(booking && booking.pickupAt))) return null;

    return (cars || []).filter(function (car) {
      return car && car.status === "available" && Number(car.size) >= requiredSeats;
    }).filter(function (car) {
      return !hasConflict(car, booking, bookings, excludeBookingId);
    })[0] || null;
  }

  return { endTime: endTime, hasConflict: hasConflict, findAvailableCar: findAvailableCar };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PHCVehicleAssignment;
