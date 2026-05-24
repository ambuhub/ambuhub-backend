import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeFreeRanges, type TimeInterval } from "./booking-availability";
import {
  buildHourlySegments,
  getScheduledWindowsForDate,
  lagosDateString,
  normalizeHourlyBookingSchedule,
  type HourlyBookingSchedule,
} from "./hourly-booking-schedule";
import { lagosWallClockToDate } from "./hireReturnWindow";

const baseSchedule: HourlyBookingSchedule = {
  default: {
    daysOfWeek: [1, 2, 3, 4, 5],
    timeStart: "09:00",
    timeEnd: "18:00",
  },
  overrides: [],
};

describe("buildHourlySegments", () => {
  it("uses default windows on weekdays", () => {
    const from = lagosWallClockToDate(2026, 5, 26, "00:00");
    const to = lagosWallClockToDate(2026, 5, 27, "00:00");
    const segs = buildHourlySegments(baseSchedule, from, to);
    assert.ok(segs.length >= 1);
    const { kind } = getScheduledWindowsForDate(baseSchedule, "2026-05-26");
    assert.equal(kind, "default");
  });

  it("honors closed override", () => {
    const schedule: HourlyBookingSchedule = {
      ...baseSchedule,
      overrides: [{ date: "2026-05-26", kind: "closed" }],
    };
    const from = lagosWallClockToDate(2026, 5, 26, "00:00");
    const to = lagosWallClockToDate(2026, 5, 27, "00:00");
    const segs = buildHourlySegments(schedule, from, to);
    assert.equal(segs.length, 0);
  });

  it("supports multiple custom windows on one day", () => {
    const schedule: HourlyBookingSchedule = {
      ...baseSchedule,
      overrides: [
        {
          date: "2026-05-26",
          kind: "custom",
          windows: [
            { timeStart: "01:00", timeEnd: "06:00" },
            { timeStart: "12:00", timeEnd: "21:00" },
          ],
        },
      ],
    };
    const from = lagosWallClockToDate(2026, 5, 26, "00:00");
    const to = lagosWallClockToDate(2026, 5, 27, "00:00");
    const segs = buildHourlySegments(schedule, from, to);
    assert.equal(segs.length, 2);
  });
});

describe("gap buffer after booking", () => {
  it("blocks availability until gap ends", () => {
    const date = "2026-05-26";
    const from = lagosWallClockToDate(2026, 5, 26, "00:00");
    const to = lagosWallClockToDate(2026, 5, 27, "00:00");
    const segments = buildHourlySegments(baseSchedule, from, to);
    const busy: TimeInterval[] = [
      {
        start: lagosWallClockToDate(2026, 5, 26, "11:00"),
        end: lagosWallClockToDate(2026, 5, 26, "15:00"),
      },
    ];
    const gapMinutes = 120;
    const free = computeFreeRanges(segments, busy, gapMinutes);
    const fivePm = lagosWallClockToDate(2026, 5, 26, "17:00").getTime();
    const fourPm = lagosWallClockToDate(2026, 5, 26, "16:00").getTime();
    const fitsFive = free.some(
      (f) => fivePm >= f.start.getTime() && fivePm + 3600000 <= f.end.getTime(),
    );
    const fitsFour = free.some(
      (f) => fourPm >= f.start.getTime() && fourPm + 3600000 <= f.end.getTime(),
    );
    assert.ok(fitsFive);
    assert.equal(fitsFour, false);
    assert.equal(lagosDateString(new Date(free[0]?.start ?? from)), date);
  });
});

describe("normalizeHourlyBookingSchedule", () => {
  it("rejects overlapping custom windows", () => {
    assert.throws(() =>
      normalizeHourlyBookingSchedule(
        {
          default: baseSchedule.default,
          overrides: [
            {
              date: lagosDateString(),
              kind: "custom",
              windows: [
                { timeStart: "09:00", timeEnd: "12:00" },
                { timeStart: "11:00", timeEnd: "14:00" },
              ],
            },
          ],
        },
        { required: true },
      ),
    );
  });
});
