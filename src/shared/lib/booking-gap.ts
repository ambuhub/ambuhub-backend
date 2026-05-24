/** Gap between bookings is configured in hours; stored as whole minutes in the database. */

export const MAX_BOOKING_GAP_HOURS = 24;
const MAX_GAP_MINUTES = MAX_BOOKING_GAP_HOURS * 60;

export function gapMinutesToHours(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 0;
  }
  return minutes / 60;
}

export function gapHoursToMinutes(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }
  return Math.round(hours * 60);
}

export function normalizeBookingGapHours(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") {
    return 0;
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("bookingGapHours must be a non-negative number");
  }
  if (n > MAX_BOOKING_GAP_HOURS) {
    throw new Error(`bookingGapHours must be at most ${MAX_BOOKING_GAP_HOURS}`);
  }
  return gapHoursToMinutes(n);
}

/** @deprecated Legacy PATCH field; prefer bookingGapHours. */
export function normalizeBookingGapMinutes(raw: unknown): number {
  if (raw === null || raw === undefined) {
    return 0;
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("bookingGapMinutes must be a non-negative integer");
  }
  if (n > MAX_GAP_MINUTES) {
    throw new Error(`bookingGapMinutes must be at most ${MAX_GAP_MINUTES}`);
  }
  return n;
}

/** Resolve PATCH body: prefer bookingGapHours; fall back to legacy bookingGapMinutes. */
export function resolveBookingGapMinutesFromInput(input: {
  bookingGapHours?: unknown;
  bookingGapMinutes?: unknown;
}): number | undefined {
  if (input.bookingGapHours !== undefined) {
    return normalizeBookingGapHours(input.bookingGapHours);
  }
  if (input.bookingGapMinutes !== undefined) {
    return normalizeBookingGapMinutes(input.bookingGapMinutes);
  }
  return undefined;
}
