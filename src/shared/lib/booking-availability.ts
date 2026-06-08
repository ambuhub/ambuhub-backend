import mongoose from "mongoose";
import { Order } from "../../models/order.model";
import {
  assertBookRangeInWindow,
  type BookingWindow,
  type HirePricingPeriod,
} from "./bookingWindow";
import {
  assertSameLagosCalendarDay,
  buildHourlySegments,
  getScheduledWindowsForDate,
  hasValidHourlySchedule,
  lagosDateString,
  type HourlyBookingSchedule,
} from "./hourly-booking-schedule";
import { getLagosDateParts, lagosWallClockToDate } from "./hireReturnWindow";

export { normalizeBookingGapMinutes } from "./booking-gap";

export type TimeInterval = { start: Date; end: Date };

function parseHmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function expandIntervalWithGap(interval: TimeInterval, gapMinutes: number): TimeInterval {
  if (gapMinutes <= 0) {
    return interval;
  }
  return {
    start: interval.start,
    end: new Date(interval.end.getTime() + gapMinutes * 60 * 1000),
  };
}

function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) {
    return [];
  }
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: TimeInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) {
        last.end = cur.end;
      }
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function subtractBusyFromSegment(
  segment: TimeInterval,
  busyExpanded: TimeInterval[],
): TimeInterval[] {
  let free: TimeInterval[] = [segment];
  for (const b of busyExpanded) {
    const next: TimeInterval[] = [];
    for (const f of free) {
      if (!intervalsOverlap(f, b)) {
        next.push(f);
        continue;
      }
      if (f.start.getTime() < b.start.getTime()) {
        next.push({ start: f.start, end: new Date(Math.min(f.end.getTime(), b.start.getTime())) });
      }
      if (f.end.getTime() > b.end.getTime()) {
        next.push({ start: new Date(Math.max(f.start.getTime(), b.end.getTime())), end: f.end });
      }
    }
    free = next.filter((x) => x.end.getTime() > x.start.getTime());
  }
  return free;
}

/** Weekly bookable segments for each calendar day in [from, to] (Lagos). */
export function buildWeeklySegments(
  window: BookingWindow,
  from: Date,
  to: Date,
): TimeInterval[] {
  if (to.getTime() <= from.getTime()) {
    return [];
  }
  const segments: TimeInterval[] = [];

  let cursor = new Date(from);
  const endLimit = to.getTime();
  let guard = 0;
  while (cursor.getTime() < endLimit && guard < 400) {
    guard++;
    const parts = getLagosDateParts(cursor);
    if (window.daysOfWeek.includes(parts.dayOfWeek)) {
      const segStart = lagosWallClockToDate(
        parts.year,
        parts.month,
        parts.day,
        window.timeStart,
      );
      const segEnd = lagosWallClockToDate(
        parts.year,
        parts.month,
        parts.day,
        window.timeEnd,
      );
      const clippedStart = new Date(Math.max(segStart.getTime(), from.getTime()));
      const clippedEnd = new Date(Math.min(segEnd.getTime(), endLimit));
      if (clippedEnd.getTime() > clippedStart.getTime()) {
        segments.push({ start: clippedStart, end: clippedEnd });
      }
    }
    const nextDay = lagosWallClockToDate(parts.year, parts.month, parts.day, "23:59");
    cursor = new Date(nextDay.getTime() + 60 * 1000);
    if (cursor.getTime() <= from.getTime()) {
      cursor = new Date(from.getTime() + 86400000);
    }
  }
  return segments;
}

export function computeFreeRanges(
  weeklySegments: TimeInterval[],
  busyIntervals: TimeInterval[],
  gapMinutes: number,
): TimeInterval[] {
  const busyExpanded = mergeIntervals(
    busyIntervals.map((b) => expandIntervalWithGap(b, gapMinutes)),
  );
  let free: TimeInterval[] = [];
  for (const seg of weeklySegments) {
    free.push(...subtractBusyFromSegment(seg, busyExpanded));
  }
  return mergeIntervals(free);
}

export function isRangeWithinFreeRanges(
  bookStart: Date,
  bookEnd: Date,
  freeRanges: TimeInterval[],
): boolean {
  for (const f of freeRanges) {
    if (
      bookStart.getTime() >= f.start.getTime() &&
      bookEnd.getTime() <= f.end.getTime()
    ) {
      return true;
    }
  }
  return false;
}

function segmentsForScheduleDate(
  schedule: HourlyBookingSchedule,
  dateStr: string,
): TimeInterval[] {
  const { windows } = getScheduledWindowsForDate(schedule, dateStr);
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  const segments: TimeInterval[] = [];
  for (const w of windows) {
    const start = lagosWallClockToDate(y, m, d, w.timeStart);
    const end = lagosWallClockToDate(y, m, d, w.timeEnd);
    if (end.getTime() > start.getTime()) {
      segments.push({ start, end });
    }
  }
  return segments;
}

function enumerateInclusiveLagosDateStrings(startDate: string, endDate: string): string[] {
  if (startDate > endDate) {
    return [];
  }
  const dates: string[] = [];
  let cur = startDate;
  let guard = 0;
  while (cur <= endDate && guard < 120) {
    guard++;
    dates.push(cur);
    const [y, m, d] = cur.split("-").map((x) => parseInt(x, 10));
    const next = new Date(lagosWallClockToDate(y, m, d, "12:00").getTime() + 86400000);
    cur = lagosDateString(next);
  }
  return dates;
}

/** Lagos YYYY-MM-DD strings in range that have at least one free schedule segment. */
export function listBillableDatesInScheduleRange(
  bookStart: Date,
  bookEnd: Date,
  schedule: HourlyBookingSchedule,
  busy: TimeInterval[],
  gapMinutes: number,
): string[] {
  const startDate = lagosDateString(bookStart);
  const endDate = lagosDateString(bookEnd);
  const dates = enumerateInclusiveLagosDateStrings(startDate, endDate);
  if (dates.length === 0) {
    return [];
  }
  const billable: string[] = [];
  for (const dateStr of dates) {
    const daySegments = segmentsForScheduleDate(schedule, dateStr);
    if (daySegments.length === 0) {
      continue;
    }
    const dayFree = computeFreeRanges(daySegments, busy, gapMinutes);
    if (dayFree.length > 0) {
      billable.push(dateStr);
    }
  }
  return billable;
}

/** Count billable days in range; unavailable days are excluded. */
export function countBillableDaysInScheduleRange(
  bookStart: Date,
  bookEnd: Date,
  schedule: HourlyBookingSchedule,
  busy: TimeInterval[],
  gapMinutes: number,
): number {
  return listBillableDatesInScheduleRange(
    bookStart,
    bookEnd,
    schedule,
    busy,
    gapMinutes,
  ).length;
}

function instantsForBillableScheduleDate(
  schedule: HourlyBookingSchedule,
  dateStr: string,
): { start: Date; end: Date } | null {
  const { windows } = getScheduledWindowsForDate(schedule, dateStr);
  if (windows.length === 0) {
    return null;
  }
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  const firstWindow = windows[0];
  const lastWindow = windows[windows.length - 1];
  const start = lagosWallClockToDate(y, m, d, firstWindow.timeStart);
  const end = lagosWallClockToDate(y, m, d, lastWindow.timeEnd);
  if (end.getTime() <= start.getTime()) {
    return null;
  }
  return { start, end };
}

/** First/last billable day instants using per-day schedule windows (for provider-facing order bounds). */
export function resolveBillableBookRangeInstants(
  bookStart: Date,
  bookEnd: Date,
  schedule: HourlyBookingSchedule,
  busy: TimeInterval[],
  gapMinutes: number,
): { start: Date; end: Date } | null {
  const billableDates = listBillableDatesInScheduleRange(
    bookStart,
    bookEnd,
    schedule,
    busy,
    gapMinutes,
  );
  if (billableDates.length === 0) {
    return null;
  }
  const firstDay = instantsForBillableScheduleDate(schedule, billableDates[0]);
  const lastDay = instantsForBillableScheduleDate(
    schedule,
    billableDates[billableDates.length - 1],
  );
  if (!firstDay || !lastDay) {
    return null;
  }
  if (lastDay.end.getTime() <= firstDay.start.getTime()) {
    return null;
  }
  return { start: firstDay.start, end: lastDay.end };
}

/** Provider dashboard display: snap to first/last schedule-open days (ignore busy). */
export function resolveProviderDisplayBookRange(
  bookStart: Date,
  bookEnd: Date,
  schedule: HourlyBookingSchedule,
): { start: Date; end: Date } | null {
  return resolveBillableBookRangeInstants(bookStart, bookEnd, schedule, [], 0);
}

/** Daily multi-day: valid when at least one day in range is billable. */
export function isDailyBookRangeWithinSchedule(
  bookStart: Date,
  bookEnd: Date,
  schedule: HourlyBookingSchedule,
  busy: TimeInterval[],
  gapMinutes: number,
): boolean {
  return countBillableDaysInScheduleRange(bookStart, bookEnd, schedule, busy, gapMinutes) >= 1;
}

export function rangesConflictWithBusy(
  bookStart: Date,
  bookEnd: Date,
  busyIntervals: TimeInterval[],
  gapMinutes: number,
): boolean {
  const candidate: TimeInterval = { start: bookStart, end: bookEnd };
  for (const busy of busyIntervals) {
    const expanded = expandIntervalWithGap(busy, gapMinutes);
    if (intervalsOverlap(candidate, expanded)) {
      return true;
    }
    if (
      gapMinutes > 0 &&
      bookStart.getTime() < expanded.end.getTime() &&
      bookEnd.getTime() > busy.start.getTime()
    ) {
      return true;
    }
  }
  return false;
}

export async function loadBusyBookIntervals(
  serviceId: string,
  from: Date,
  to: Date,
): Promise<TimeInterval[]> {
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    return [];
  }
  const oid = new mongoose.Types.ObjectId(serviceId);
  const orders = await Order.find({
    lines: {
      $elemMatch: {
        serviceId: oid,
        lineKind: "book",
        bookStart: { $lt: to },
        bookEnd: { $gt: from },
      },
    },
  })
    .select("lines")
    .lean();

  const busy: TimeInterval[] = [];
  for (const order of orders) {
    const lines = order.lines as {
      serviceId?: mongoose.Types.ObjectId;
      lineKind?: string;
      bookStart?: Date;
      bookEnd?: Date;
    }[];
    for (const line of lines) {
      if (line.lineKind !== "book") {
        continue;
      }
      if (!line.serviceId || line.serviceId.toString() !== serviceId) {
        continue;
      }
      if (!line.bookStart || !line.bookEnd) {
        continue;
      }
      busy.push({ start: line.bookStart, end: line.bookEnd });
    }
  }
  return mergeIntervals(busy);
}

export async function assertBookRangeAvailable(
  serviceId: string,
  bookStart: Date,
  bookEnd: Date,
  gapMinutes: number,
  pricingPeriod: HirePricingPeriod,
  options: {
    bookingWindow?: BookingWindow | null;
    hourlySchedule?: HourlyBookingSchedule | null;
  },
): Promise<void> {
  const from = new Date(bookStart.getTime() - 86400000);
  const to = new Date(bookEnd.getTime() + 86400000);
  const busy = await loadBusyBookIntervals(serviceId, from, to);

  if (rangesConflictWithBusy(bookStart, bookEnd, busy, gapMinutes)) {
    throw new Error("Selected time conflicts with an existing booking");
  }

  const schedule = options.hourlySchedule;
  if (schedule && hasValidHourlySchedule(schedule)) {
    if (pricingPeriod === "hourly") {
      assertSameLagosCalendarDay(bookStart, bookEnd);
      const segments = buildHourlySegments(schedule, from, to);
      const free = computeFreeRanges(segments, busy, gapMinutes);
      if (!isRangeWithinFreeRanges(bookStart, bookEnd, free)) {
        throw new Error("Selected time is outside available booking hours");
      }
      return;
    }
    if (!isDailyBookRangeWithinSchedule(bookStart, bookEnd, schedule, busy, gapMinutes)) {
      throw new Error("Selected time is outside available booking hours");
    }
    return;
  }

  const window = options.bookingWindow;
  if (!window) {
    throw new Error("This listing has no booking schedule");
  }
  assertBookRangeInWindow(bookStart, bookEnd, window, pricingPeriod);
  if (pricingPeriod === "daily") {
    const syntheticSchedule: HourlyBookingSchedule = { default: window, overrides: [] };
    if (!isDailyBookRangeWithinSchedule(bookStart, bookEnd, syntheticSchedule, busy, gapMinutes)) {
      throw new Error("Selected time is outside available booking hours");
    }
    return;
  }
  const weekly = buildWeeklySegments(window, from, to);
  const free = computeFreeRanges(weekly, busy, gapMinutes);
  if (!isRangeWithinFreeRanges(bookStart, bookEnd, free)) {
    throw new Error("Selected time is outside available booking hours");
  }
}
