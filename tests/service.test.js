/* Unit tests for PHCService.validate in js/book-service.js (PHC-19 / US04). */
(function () {
  "use strict";
  var test = PHCTest.test;
  var equal = PHCTest.equal;
  var S = PHC_DATA.services;

  test("service: no service chosen is rejected", function () {
    var r = PHCService.validate(S, { service: "" });
    equal(r.ok, false);
    equal(r.errors.service, "Please choose a service");
  });

  test("service: unknown service id is rejected", function () {
    equal(PHCService.validate(S, { service: "helicopter" }).ok, false);
  });

  test("service: local journey needs nothing else", function () {
    equal(PHCService.validate(S, { service: "local" }).ok, true);
  });

  test("service: airport transfer without flight number is rejected", function () {
    var r = PHCService.validate(S, { service: "airport", flight: "" });
    equal(r.ok, false);
    equal(typeof r.errors.flight, "string");
  });

  test("service: airport transfer accepts BA123", function () {
    equal(PHCService.validate(S, { service: "airport", flight: "BA123" }).ok, true);
  });

  test("service: meet & greet also needs a flight number", function () {
    equal(PHCService.validate(S, { service: "meet-greet", flight: "" }).ok, false);
    equal(PHCService.validate(S, { service: "meet-greet", flight: "EK7" }).ok, true);
  });

  test("service: flight format - 'ab' (no digits) and 'BA12345' (5 digits) are rejected", function () {
    equal(PHCService.validate(S, { service: "airport", flight: "ab" }).ok, false);
    equal(PHCService.validate(S, { service: "airport", flight: "BA12345" }).ok, false);
  });

  test("service: flight format - lower case is accepted (stored in upper case by the page)", function () {
    equal(PHCService.validate(S, { service: "airport", flight: "ba123" }).ok, true);
  });

  test("service: daily hire without hours is rejected", function () {
    equal(PHCService.validate(S, { service: "daily-hire", hours: "" }).ok, false);
  });

  test("service: daily hire hours boundary 1 and 12 accepted, 0 and 13 rejected", function () {
    equal(PHCService.validate(S, { service: "daily-hire", hours: 1 }).ok, true);
    equal(PHCService.validate(S, { service: "daily-hire", hours: 12 }).ok, true);
    equal(PHCService.validate(S, { service: "daily-hire", hours: 0 }).ok, false);
    equal(PHCService.validate(S, { service: "daily-hire", hours: 13 }).ok, false);
  });

  test("service: daily hire rejects 2.5 hours and text", function () {
    equal(PHCService.validate(S, { service: "daily-hire", hours: "2.5" }).ok, false);
    equal(PHCService.validate(S, { service: "daily-hire", hours: "abc" }).ok, false);
  });

  test("service: flight is not required for non-airport services", function () {
    equal(PHCService.validate(S, { service: "hotel", flight: "" }).ok, true);
  });
})();
