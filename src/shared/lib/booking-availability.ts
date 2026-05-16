import mongoose from "mongoose";
import { Order } from "../../models/order.model";
import {
  assertBookRangeInWindow,
  type BookingWindow,
  type HirePricingPeriod,
} from "./bookingWindow";
import { getLagosDateParts, lagosWallClockToDate } from "./hireReturnWindow";

export type TimeInterval = { start: Date; end: Date };

const MAX_GAP_MINUTES = 24 * 60;

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
  window: BookingWindow,
  gapMinutes: number,
  pricingPeriod: HirePricingPeriod,
): Promise<void> {
  assertBookRangeInWindow(bookStart, bookEnd, window, pricingPeriod);

  const from = new Date(bookStart.getTime() - 86400000);
  const to = new Date(bookEnd.getTime() + 86400000);
  const busy = await loadBusyBookIntervals(serviceId, from, to);
  if (rangesConflictWithBusy(bookStart, bookEnd, busy, gapMinutes)) {
    throw new Error("Selected time conflicts with an existing booking");
  }

  const weekly = buildWeeklySegments(window, from, to);
  const free = computeFreeRanges(weekly, busy, gapMinutes);
  if (!isRangeWithinFreeRanges(bookStart, bookEnd, free)) {
    throw new Error("Selected time is outside available booking hours");
  }
}
