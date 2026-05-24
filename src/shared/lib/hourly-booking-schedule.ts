import {
  getLagosDateParts,
  lagosWallClockToDate,
  normalizeHireReturnWindow,
  parseHireReturnWindowFromDoc,
  type DayOfWeek,
  type HireReturnWindow,
} from "./hireReturnWindow";
import type { TimeInterval } from "./booking-availability";

export const HOURLY_OVERRIDE_HORIZON_DAYS = 30;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type TimeRange = {
  timeStart: string;
  timeEnd: string;
};

export type HourlyScheduleOverride =
  | { date: string; kind: "closed" }
  | { date: string; kind: "custom"; windows: TimeRange[] };

export type HourlyBookingSchedule = {
  default: HireReturnWindow;
  overrides: HourlyScheduleOverride[];
};

export type HourlyDayKind = "default" | "custom" | "closed" | "unavailable";

export const EMPTY_HOURLY_SCHEDULE: HourlyBookingSchedule = {
  default: {
    daysOfWeek: [],
    timeStart: "09:00",
    timeEnd: "17:00",
  },
  overrides: [],
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function lagosDateString(d: Date): string {
  const p = getLagosDateParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function parseHmToMinutes(hm: string): number {
  const m = hm.match(HH_MM);
  if (!m) {
    throw new Error("Invalid time");
  }
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function validateTimeRange(range: TimeRange, label: string): void {
  if (!HH_MM.test(range.timeStart) || !HH_MM.test(range.timeEnd)) {
    throw new Error(`${label}: times must be HH:mm`);
  }
  if (parseHmToMinutes(range.timeStart) >= parseHmToMinutes(range.timeEnd)) {
    throw new Error(`${label}: end time must be after start time`);
  }
}

function sortAndValidateWindows(windows: TimeRange[]): TimeRange[] {
  const sorted = [...windows].sort(
    (a, b) => parseHmToMinutes(a.timeStart) - parseHmToMinutes(b.timeStart),
  );
  for (let i = 0; i < sorted.length; i++) {
    validateTimeRange(sorted[i], `Window ${i + 1}`);
    if (i > 0 && parseHmToMinutes(sorted[i].timeStart) < parseHmToMinutes(sorted[i - 1].timeEnd)) {
      throw new Error("Custom windows must not overlap");
    }
  }
  return sorted;
}

export function getOverrideHorizonEnd(from: Date = new Date()): Date {
  const p = getLagosDateParts(from);
  const end = lagosWallClockToDate(p.year, p.month, p.day, "23:59");
  return new Date(end.getTime() + HOURLY_OVERRIDE_HORIZON_DAYS * 86400000);
}

export function isDateInOverrideHorizon(dateStr: string, now: Date = new Date()): boolean {
  if (!DATE_ONLY_RE.test(dateStr)) {
    return false;
  }
  const today = lagosDateString(now);
  if (dateStr < today) {
    return false;
  }
  const horizonEnd = lagosDateString(getOverrideHorizonEnd(now));
  return dateStr <= horizonEnd;
}

export function normalizeHourlyBookingSchedule(
  input: unknown,
  options: { required: boolean },
): HourlyBookingSchedule | null {
  if (input === undefined || input === null) {
    if (options.required) {
      throw new Error("hourlyBookingSchedule is required");
    }
    return null;
  }
  if (typeof input !== "object") {
    throw new Error("hourlyBookingSchedule must be an object");
  }
  const raw = input as Record<string, unknown>;
  const def = normalizeHireReturnWindow(raw.default, { required: true });
  const overridesRaw = Array.isArray(raw.overrides) ? raw.overrides : [];
  const overrides: HourlyScheduleOverride[] = [];
  const seenDates = new Set<string>();

  for (const item of overridesRaw) {
    if (!item || typeof item !== "object") {
      throw new Error("Each override must be an object");
    }
    const o = item as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date.trim() : "";
    if (!DATE_ONLY_RE.test(date)) {
      throw new Error("Override date must be YYYY-MM-DD");
    }
    if (!isDateInOverrideHorizon(date)) {
      throw new Error(
        `Override date ${date} must be within the next ${HOURLY_OVERRIDE_HORIZON_DAYS} days (WAT)`,
      );
    }
    if (seenDates.has(date)) {
      throw new Error(`Duplicate override for ${date}`);
    }
    seenDates.add(date);

    const kind = o.kind;
    if (kind === "closed") {
      overrides.push({ date, kind: "closed" });
      continue;
    }
    if (kind === "custom") {
      if (!Array.isArray(o.windows) || o.windows.length === 0) {
        throw new Error(`Custom override for ${date} needs at least one time window`);
      }
      const windows: TimeRange[] = o.windows.map((w, i) => {
        if (!w || typeof w !== "object") {
          throw new Error(`Window ${i + 1} on ${date} is invalid`);
        }
        const wr = w as Record<string, unknown>;
        const timeStart = typeof wr.timeStart === "string" ? wr.timeStart.trim() : "";
        const timeEnd = typeof wr.timeEnd === "string" ? wr.timeEnd.trim() : "";
        return { timeStart, timeEnd };
      });
      overrides.push({ date, kind: "custom", windows: sortAndValidateWindows(windows) });
      continue;
    }
    throw new Error(`Override for ${date} must be kind "closed" or "custom"`);
  }

  overrides.sort((a, b) => a.date.localeCompare(b.date));
  return { default: def, overrides };
}

export function parseHourlyBookingScheduleFromDoc(raw: unknown): HourlyBookingSchedule | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  try {
    return normalizeHourlyBookingSchedule(raw, { required: true });
  } catch {
    return null;
  }
}

/** Migrate legacy bookingWindow when hourly schedule is absent. */
export function resolveHourlyBookingSchedule(
  hourlyRaw: unknown,
  bookingWindowRaw: unknown,
): HourlyBookingSchedule | null {
  const parsed = parseHourlyBookingScheduleFromDoc(hourlyRaw);
  if (parsed) {
    return parsed;
  }
  const legacy = parseHireReturnWindowFromDoc(bookingWindowRaw);
  if (!legacy || legacy.daysOfWeek.length === 0) {
    return null;
  }
  return { default: legacy, overrides: [] };
}

export function hasValidHourlySchedule(
  schedule: HourlyBookingSchedule | null | undefined,
): schedule is HourlyBookingSchedule {
  return !!schedule && schedule.default.daysOfWeek.length > 0;
}

export function getOverrideForDate(
  schedule: HourlyBookingSchedule,
  dateStr: string,
): HourlyScheduleOverride | null {
  return schedule.overrides.find((o) => o.date === dateStr) ?? null;
}

export function getScheduledWindowsForDate(
  schedule: HourlyBookingSchedule,
  dateStr: string,
): { kind: HourlyDayKind; windows: TimeRange[] } {
  const override = getOverrideForDate(schedule, dateStr);
  if (override?.kind === "closed") {
    return { kind: "closed", windows: [] };
  }
  if (override?.kind === "custom") {
    return { kind: "custom", windows: override.windows };
  }

  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  const probe = lagosWallClockToDate(y, m, d, "12:00");
  const parts = getLagosDateParts(probe);
  if (!schedule.default.daysOfWeek.includes(parts.dayOfWeek)) {
    return { kind: "unavailable", windows: [] };
  }
  return {
    kind: "default",
    windows: [
      { timeStart: schedule.default.timeStart, timeEnd: schedule.default.timeEnd },
    ],
  };
}

function addLagosDays(year: number, month: number, day: number, offset: number): string {
  const base = lagosWallClockToDate(year, month, day, "12:00");
  const next = new Date(base.getTime() + offset * 86400000);
  return lagosDateString(next);
}

/** Enumerate Lagos YYYY-MM-DD strings from from (inclusive) to to (exclusive day boundary). */
export function enumerateLagosDates(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const startParts = getLagosDateParts(from);
  let cur = lagosDateString(from);
  const endStr = lagosDateString(new Date(to.getTime() - 1));
  let guard = 0;
  while (cur <= endStr && guard < 120) {
    guard++;
    dates.push(cur);
    const [y, m, d] = cur.split("-").map((x) => parseInt(x, 10));
    cur = addLagosDays(y, m, d, 1);
  }
  if (dates.length === 0 && from.getTime() < to.getTime()) {
    dates.push(lagosDateString(from));
  }
  return dates;
}

function windowsToSegmentsOnDate(dateStr: string, windows: TimeRange[]): TimeInterval[] {
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

export function buildHourlySegments(
  schedule: HourlyBookingSchedule,
  from: Date,
  to: Date,
): TimeInterval[] {
  if (to.getTime() <= from.getTime()) {
    return [];
  }
  const segments: TimeInterval[] = [];
  for (const dateStr of enumerateLagosDates(from, to)) {
    const { windows } = getScheduledWindowsForDate(schedule, dateStr);
    for (const seg of windowsToSegmentsOnDate(dateStr, windows)) {
      const clippedStart = new Date(Math.max(seg.start.getTime(), from.getTime()));
      const clippedEnd = new Date(Math.min(seg.end.getTime(), to.getTime()));
      if (clippedEnd.getTime() > clippedStart.getTime()) {
        segments.push({ start: clippedStart, end: clippedEnd });
      }
    }
  }
  return segments;
}

export function assertSameLagosCalendarDay(bookStart: Date, bookEnd: Date): void {
  const a = lagosDateString(bookStart);
  const b = lagosDateString(bookEnd);
  if (a !== b) {
    throw new Error("Hourly bookings must start and end on the same calendar day (WAT)");
  }
}

export function hasHourlyBookingScheduleInput(input: {
  hourlyBookingSchedule?: unknown;
}): boolean {
  return input.hourlyBookingSchedule !== undefined;
}
