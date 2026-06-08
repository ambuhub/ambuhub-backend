import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countBillableDaysInScheduleRange,
  isDailyBookRangeWithinSchedule,
  resolveBillableBookRangeInstants,
  resolveProviderDisplayBookRange,
} from "./booking-availability";
import type { HourlyBookingSchedule } from "./hourly-booking-schedule";
import { lagosWallClockToDate } from "./hireReturnWindow";

const weekdaySchedule: HourlyBookingSchedule = {
  default: {
    daysOfWeek: [1, 2, 3, 4, 5],
    timeStart: "09:00",
    timeEnd: "16:00",
  },
  overrides: [],
};

describe("countBillableDaysInScheduleRange", () => {
  it("counts Mon–Wed when each weekday has free segments and no busy time", () => {
    const bookStart = lagosWallClockToDate(2026, 5, 26, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 28, "16:00");
    assert.equal(
      countBillableDaysInScheduleRange(bookStart, bookEnd, weekdaySchedule, [], 0),
      3,
    );
  });

  it("skips a closed override day but keeps other billable days", () => {
    const schedule: HourlyBookingSchedule = {
      ...weekdaySchedule,
      overrides: [{ date: "2026-05-27", kind: "closed" }],
    };
    const bookStart = lagosWallClockToDate(2026, 5, 26, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 28, "16:00");
    assert.equal(
      countBillableDaysInScheduleRange(bookStart, bookEnd, schedule, [], 0),
      2,
    );
    assert.equal(
      isDailyBookRangeWithinSchedule(bookStart, bookEnd, schedule, [], 0),
      true,
    );
  });

  it("skips a fully booked day but keeps other billable days", () => {
    const bookStart = lagosWallClockToDate(2026, 5, 26, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 28, "16:00");
    const busy = [
      {
        start: lagosWallClockToDate(2026, 5, 27, "09:00"),
        end: lagosWallClockToDate(2026, 5, 27, "16:00"),
      },
    ];
    assert.equal(
      countBillableDaysInScheduleRange(bookStart, bookEnd, weekdaySchedule, busy, 0),
      2,
    );
    assert.equal(
      isDailyBookRangeWithinSchedule(bookStart, bookEnd, weekdaySchedule, busy, 0),
      true,
    );
  });

  it("returns zero when the entire range has no billable days", () => {
    const schedule: HourlyBookingSchedule = {
      default: { daysOfWeek: [1, 2, 3, 4, 5], timeStart: "09:00", timeEnd: "16:00" },
      overrides: [
        { date: "2026-05-30", kind: "closed" },
        { date: "2026-05-31", kind: "closed" },
      ],
    };
    const bookStart = lagosWallClockToDate(2026, 5, 30, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 31, "16:00");
    assert.equal(
      countBillableDaysInScheduleRange(bookStart, bookEnd, schedule, [], 0),
      0,
    );
    assert.equal(
      isDailyBookRangeWithinSchedule(bookStart, bookEnd, schedule, [], 0),
      false,
    );
  });
});

describe("resolveBillableBookRangeInstants", () => {
  it("snaps to first and last billable days, skipping a closed middle day", () => {
    const schedule: HourlyBookingSchedule = {
      ...weekdaySchedule,
      overrides: [{ date: "2026-05-27", kind: "closed" }],
    };
    const bookStart = lagosWallClockToDate(2026, 5, 26, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 28, "16:00");
    const resolved = resolveBillableBookRangeInstants(bookStart, bookEnd, schedule, [], 0);
    assert.ok(resolved);
    assert.equal(resolved!.start.getTime(), lagosWallClockToDate(2026, 5, 26, "09:00").getTime());
    assert.equal(resolved!.end.getTime(), lagosWallClockToDate(2026, 5, 28, "16:00").getTime());
  });

  it("snaps start when bookStart falls on a closed day", () => {
    const schedule: HourlyBookingSchedule = {
      ...weekdaySchedule,
      overrides: [{ date: "2026-05-27", kind: "closed" }],
    };
    const bookStart = lagosWallClockToDate(2026, 5, 27, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 28, "16:00");
    const resolved = resolveBillableBookRangeInstants(bookStart, bookEnd, schedule, [], 0);
    assert.ok(resolved);
    assert.equal(resolved!.start.getTime(), lagosWallClockToDate(2026, 5, 28, "09:00").getTime());
    assert.equal(resolved!.end.getTime(), lagosWallClockToDate(2026, 5, 28, "16:00").getTime());
  });

  it("snaps end when bookEnd falls on a closed day", () => {
    const schedule: HourlyBookingSchedule = {
      ...weekdaySchedule,
      overrides: [{ date: "2026-05-27", kind: "closed" }],
    };
    const bookStart = lagosWallClockToDate(2026, 5, 26, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 27, "16:00");
    const resolved = resolveBillableBookRangeInstants(bookStart, bookEnd, schedule, [], 0);
    assert.ok(resolved);
    assert.equal(resolved!.start.getTime(), lagosWallClockToDate(2026, 5, 26, "09:00").getTime());
    assert.equal(resolved!.end.getTime(), lagosWallClockToDate(2026, 5, 26, "16:00").getTime());
  });

  it("returns null when the entire range has no billable days", () => {
    const schedule: HourlyBookingSchedule = {
      default: { daysOfWeek: [1, 2, 3, 4, 5], timeStart: "09:00", timeEnd: "16:00" },
      overrides: [
        { date: "2026-05-30", kind: "closed" },
        { date: "2026-05-31", kind: "closed" },
      ],
    };
    const bookStart = lagosWallClockToDate(2026, 5, 30, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 31, "16:00");
    assert.equal(
      resolveBillableBookRangeInstants(bookStart, bookEnd, schedule, [], 0),
      null,
    );
  });
});

describe("resolveProviderDisplayBookRange", () => {
  it("snaps outer range endpoints to schedule-open days, ignoring busy", () => {
    const schedule: HourlyBookingSchedule = {
      ...weekdaySchedule,
      overrides: [{ date: "2026-05-27", kind: "closed" }],
    };
    const bookStart = lagosWallClockToDate(2026, 5, 26, "09:00");
    const bookEnd = lagosWallClockToDate(2026, 5, 28, "16:00");
    const busy = [
      {
        start: lagosWallClockToDate(2026, 5, 26, "09:00"),
        end: lagosWallClockToDate(2026, 5, 28, "16:00"),
      },
    ];
    const withBusy = resolveBillableBookRangeInstants(bookStart, bookEnd, schedule, busy, 0);
    assert.equal(withBusy, null);
    const display = resolveProviderDisplayBookRange(bookStart, bookEnd, schedule);
    assert.ok(display);
    assert.equal(display!.start.getTime(), lagosWallClockToDate(2026, 5, 26, "09:00").getTime());
    assert.equal(display!.end.getTime(), lagosWallClockToDate(2026, 5, 28, "16:00").getTime());
  });
});
