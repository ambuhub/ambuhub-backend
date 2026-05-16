import {
  assertHireEndAllowed,
  formatHireReturnWindowSummary,
  getLagosDateParts,
  hasHireReturnWindowInput,
  lagosWallClockToDate,
  normalizeHireReturnWindow,
  parseHireReturnWindowFromDoc,
  type DayOfWeek,
  type HirePricingPeriod,
  type HireReturnWindow,
} from "./hireReturnWindow";

export type BookingWindow = HireReturnWindow;
export type BookingWindowInput = { bookingWindow?: unknown };

export const parseBookingWindowFromDoc = parseHireReturnWindowFromDoc;
export const formatBookingWindowSummary = formatHireReturnWindowSummary;
export { getLagosDateParts, lagosWallClockToDate, type DayOfWeek, type HirePricingPeriod };

export function hasBookingWindowInput(input: BookingWindowInput): boolean {
  return input.bookingWindow !== undefined;
}

export function normalizeBookingWindow(
  input: unknown,
  options: { required: boolean },
): BookingWindow | null {
  if (input === undefined || input === null) {
    if (options.required) {
      throw new Error("bookingWindow is required for book listings");
    }
    return null;
  }
  return normalizeHireReturnWindow(input, { required: true });
}

export function assertBookInstantInWindow(
  instant: Date,
  window: BookingWindow,
  pricingPeriod: HirePricingPeriod,
): void {
  assertHireEndAllowed(instant, window, pricingPeriod);
}

export function assertBookRangeInWindow(
  bookStart: Date,
  bookEnd: Date,
  window: BookingWindow,
  pricingPeriod: HirePricingPeriod,
): void {
  if (bookEnd.getTime() <= bookStart.getTime()) {
    throw new Error("bookEnd must be after bookStart");
  }
  assertBookInstantInWindow(bookStart, window, pricingPeriod);
  assertBookInstantInWindow(bookEnd, window, pricingPeriod);
}
