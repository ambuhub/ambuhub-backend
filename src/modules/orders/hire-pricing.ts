import type { PricingPeriod } from "../services/services.service";
import {
  countBillableDaysInScheduleRange,
  loadBusyBookIntervals,
  resolveBillableBookRangeInstants,
} from "../../shared/lib/booking-availability";
import {
  resolveHourlyBookingSchedule,
  type HourlyBookingSchedule,
} from "../../shared/lib/hourly-booking-schedule";
import {
  lagosWallClockToDate,
  type HireReturnWindow,
} from "../../shared/lib/hireReturnWindow";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function inclusiveUtcCalendarDays(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((e - s) / 86400000) + 1;
}

/**
 * Parse hire window from request strings as UTC calendar dates (YYYY-MM-DD preferred).
 */
export function parseHireInstantRange(
  _pricingPeriod: PricingPeriod | string,
  hireStartRaw: string,
  hireEndRaw: string,
): { start: Date; end: Date } {
  const a = (hireStartRaw ?? "").trim();
  const b = (hireEndRaw ?? "").trim();
  if (!a || !b) {
    throw new Error("hireStart and hireEnd are required");
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
  const parseDay = (raw: string, label: string): Date => {
    const m = raw.match(dateOnly);
    if (!m) {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        throw new Error(`${label} must be a YYYY-MM-DD date or ISO string`);
      }
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    return new Date(Date.UTC(y, mo, day));
  };

  return {
    start: parseDay(a, "hireStart"),
    end: parseDay(b, "hireEnd"),
  };
}

/**
 * Book checkout: map YYYY-MM-DD fields to Lagos wall-clock instants using the provider window.
 */
export function parseBookCalendarRange(
  bookStartRaw: string,
  bookEndRaw: string,
  window: HireReturnWindow,
): { start: Date; end: Date } {
  const a = (bookStartRaw ?? "").trim();
  const b = (bookEndRaw ?? "").trim();
  if (!a || !b) {
    throw new Error("bookStart and bookEnd are required");
  }

  const sm = a.match(DATE_ONLY_RE);
  const em = b.match(DATE_ONLY_RE);
  if (!sm || !em) {
    throw new Error("bookStart and bookEnd must be YYYY-MM-DD for calendar-priced bookings");
  }

  const start = lagosWallClockToDate(
    parseInt(sm[1], 10),
    parseInt(sm[2], 10),
    parseInt(sm[3], 10),
    window.timeStart,
  );
  const end = lagosWallClockToDate(
    parseInt(em[1], 10),
    parseInt(em[2], 10),
    parseInt(em[3], 10),
    window.timeEnd,
  );

  if (end.getTime() <= start.getTime()) {
    throw new Error("bookEnd must be after bookStart");
  }

  return { start, end };
}

export function computeHireBillableUnits(
  _pricingPeriod: PricingPeriod | string,
  start: Date,
  end: Date,
): number {
  if (end.getTime() <= start.getTime()) {
    throw new Error("Hire end must be after hire start");
  }
  return Math.max(1, inclusiveUtcCalendarDays(start, end));
}

export type BookCheckoutRange = {
  billableUnits: number;
  effectiveStart: Date;
  effectiveEnd: Date;
};

/** Resolve billable units and provider-facing book instants (first/last billable days in range). */
export async function resolveBookCheckoutRange(
  serviceId: string,
  range: { start: Date; end: Date },
  bookingWindow: HireReturnWindow,
  hourlyScheduleRaw: unknown,
  gapMinutes: number,
): Promise<BookCheckoutRange | null> {
  const from = new Date(range.start.getTime() - 86400000);
  const to = new Date(range.end.getTime() + 86400000);
  const busy = await loadBusyBookIntervals(serviceId, from, to);
  const schedule =
    resolveHourlyBookingSchedule(hourlyScheduleRaw, bookingWindow) ??
    ({ default: bookingWindow, overrides: [] } satisfies HourlyBookingSchedule);
  const billableUnits = countBillableDaysInScheduleRange(
    range.start,
    range.end,
    schedule,
    busy,
    gapMinutes,
  );
  if (billableUnits < 1) {
    return null;
  }
  const effective = resolveBillableBookRangeInstants(
    range.start,
    range.end,
    schedule,
    busy,
    gapMinutes,
  );
  if (!effective) {
    return null;
  }
  return {
    billableUnits,
    effectiveStart: effective.start,
    effectiveEnd: effective.end,
  };
}

/** Billable daily book units: only days with free schedule time in the selected range. */
export async function computeBookBillableUnits(
  serviceId: string,
  range: { start: Date; end: Date },
  bookingWindow: HireReturnWindow,
  hourlyScheduleRaw: unknown,
  gapMinutes: number,
): Promise<number> {
  const resolved = await resolveBookCheckoutRange(
    serviceId,
    range,
    bookingWindow,
    hourlyScheduleRaw,
    gapMinutes,
  );
  return resolved?.billableUnits ?? 0;
}
