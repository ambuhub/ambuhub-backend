import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gapHoursToMinutes,
  gapMinutesToHours,
  normalizeBookingGapHours,
  resolveBookingGapMinutesFromInput,
} from "./booking-gap";

describe("normalizeBookingGapHours", () => {
  it("converts hours to stored minutes", () => {
    assert.equal(normalizeBookingGapHours(2), 120);
    assert.equal(normalizeBookingGapHours("1.5"), 90);
    assert.equal(normalizeBookingGapHours(0), 0);
  });

  it("rejects invalid values", () => {
    assert.throws(() => normalizeBookingGapHours(-1));
    assert.throws(() => normalizeBookingGapHours(25));
  });
});

describe("resolveBookingGapMinutesFromInput", () => {
  it("prefers bookingGapHours over legacy minutes", () => {
    assert.equal(
      resolveBookingGapMinutesFromInput({ bookingGapHours: 2, bookingGapMinutes: 30 }),
      120,
    );
  });

  it("falls back to bookingGapMinutes", () => {
    assert.equal(resolveBookingGapMinutesFromInput({ bookingGapMinutes: 90 }), 90);
  });
});

describe("gapMinutesToHours", () => {
  it("round-trips for display", () => {
    assert.equal(gapMinutesToHours(120), 2);
    assert.equal(gapHoursToMinutes(2), 120);
  });
});
