export type HirePricingPeriod =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

const LAGOS_TZ = "Africa/Lagos";
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HireReturnWindow = {
  daysOfWeek: DayOfWeek[];
  timeStart: string;
  timeEnd: string;
};

export type HireReturnWindowInput = {
  hireReturnWindow?: unknown;
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function parseHmToMinutes(hm: string): number {
  const m = hm.match(HH_MM);
  if (!m) {
    throw new Error("Invalid time");
  }
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatHm12(hm: string): string {
  const mins = parseHmToMinutes(hm);
  const h24 = Math.floor(mins / 60);
  const min = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

export function getLagosDateParts(d: Date): {
  dayOfWeek: DayOfWeek;
  minutesSinceMidnight: number;
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: LAGOS_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  const dayIndex = DAY_SHORT.indexOf(weekday as (typeof DAY_SHORT)[number]);
  if (dayIndex < 0) {
    throw new Error("Could not resolve weekday in Africa/Lagos");
  }

  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);

  return {
    dayOfWeek: dayIndex as DayOfWeek,
    minutesSinceMidnight: hour * 60 + minute,
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
  };
}

function formatDaysSummary(days: DayOfWeek[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.join(",") === "1,2,3,4,5") {
    return "Mon–Fri";
  }
  if (sorted.length === 7) {
    return "Every day";
  }
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}

export function formatHireReturnWindowSummary(window: HireReturnWindow): string {
  const days = formatDaysSummary(window.daysOfWeek);
  return `${days}, ${formatHm12(window.timeStart)} – ${formatHm12(window.timeEnd)} (WAT)`;
}

export function hasHireReturnWindowInput(input: HireReturnWindowInput): boolean {
  return input.hireReturnWindow !== undefined;
}

export function parseHireReturnWindowFromDoc(
  raw: unknown,
): HireReturnWindow | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  try {
    return normalizeHireReturnWindow(
      {
        daysOfWeek: o.daysOfWeek,
        timeStart: o.timeStart,
        timeEnd: o.timeEnd,
      },
      { required: true },
    );
  } catch {
    return null;
  }
}

export function normalizeHireReturnWindow(
  input: unknown,
  options: { required: boolean },
): HireReturnWindow | null {
  if (input === undefined || input === null) {
    if (options.required) {
      throw new Error("hireReturnWindow is required for hire listings");
    }
    return null;
  }
  if (typeof input !== "object") {
    throw new Error("hireReturnWindow must be an object");
  }
  const o = input as Record<string, unknown>;
  const rawDays = o.daysOfWeek;
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    throw new Error("hireReturnWindow.daysOfWeek must include at least one day");
  }
  const daysSet = new Set<DayOfWeek>();
  for (const d of rawDays) {
    const n = typeof d === "number" ? d : typeof d === "string" ? parseInt(d, 10) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      throw new Error("hireReturnWindow.daysOfWeek must be integers 0 (Sun) through 6 (Sat)");
    }
    daysSet.add(n as DayOfWeek);
  }
  const daysOfWeek = [...daysSet].sort((a, b) => a - b) as DayOfWeek[];

  const timeStart =
    typeof o.timeStart === "string" ? o.timeStart.trim() : "";
  const timeEnd = typeof o.timeEnd === "string" ? o.timeEnd.trim() : "";
  if (!HH_MM.test(timeStart)) {
    throw new Error("hireReturnWindow.timeStart must be HH:mm (24-hour)");
  }
  if (!HH_MM.test(timeEnd)) {
    throw new Error("hireReturnWindow.timeEnd must be HH:mm (24-hour)");
  }
  if (parseHmToMinutes(timeStart) >= parseHmToMinutes(timeEnd)) {
    throw new Error("hireReturnWindow.timeEnd must be after timeStart");
  }

  return { daysOfWeek, timeStart, timeEnd };
}

export function assertHireEndAllowed(
  hireEnd: Date,
  window: HireReturnWindow,
  pricingPeriod: HirePricingPeriod,
): void {
  const parts = getLagosDateParts(hireEnd);
  if (!window.daysOfWeek.includes(parts.dayOfWeek)) {
    const allowed = formatDaysSummary(window.daysOfWeek);
    throw new Error(
      `Return must be on an allowed day (${allowed}, WAT). Selected day is not accepted.`,
    );
  }

  if (pricingPeriod === "hourly") {
    const startM = parseHmToMinutes(window.timeStart);
    const endM = parseHmToMinutes(window.timeEnd);
    if (parts.minutesSinceMidnight < startM || parts.minutesSinceMidnight > endM) {
      throw new Error(
        `Return time must be between ${formatHm12(window.timeStart)} and ${formatHm12(window.timeEnd)} (WAT).`,
      );
    }
  }
}

/** Canonical return instant: for daily+ uses timeEnd on the hire end date in Lagos. */
export function resolveCanonicalHireEnd(
  hireEnd: Date,
  window: HireReturnWindow,
  pricingPeriod: HirePricingPeriod,
): Date {
  if (pricingPeriod === "hourly") {
    return hireEnd;
  }
  const parts = getLagosDateParts(hireEnd);
  const [eh, em] = window.timeEnd.split(":").map((x) => parseInt(x, 10));
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, eh, em, 0, 0);
  let candidate = new Date(utcGuess);
  const check = getLagosDateParts(candidate);
  if (
    check.year !== parts.year ||
    check.month !== parts.month ||
    check.day !== parts.day ||
    check.minutesSinceMidnight !== eh * 60 + em
  ) {
    const offsetMin = check.minutesSinceMidnight - (eh * 60 + em);
    candidate = new Date(candidate.getTime() - offsetMin * 60 * 1000);
  }
  return candidate;
}

export function formatReturnDeadline(
  hireEnd: Date,
  window: HireReturnWindow,
  pricingPeriod: HirePricingPeriod,
): string {
  const canonical = resolveCanonicalHireEnd(hireEnd, window, pricingPeriod);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: LAGOS_TZ,
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(canonical);
}

export function isHireEndAllowed(
  hireEnd: Date,
  window: HireReturnWindow,
  pricingPeriod: HirePricingPeriod,
): boolean {
  try {
    assertHireEndAllowed(hireEnd, window, pricingPeriod);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock instant for Y-M-D and HH:mm in Africa/Lagos. */
export function lagosWallClockToDate(
  year: number,
  month: number,
  day: number,
  hm: string,
): Date {
  const [eh, em] = hm.split(":").map((x) => parseInt(x, 10));
  const utcGuess = Date.UTC(year, month - 1, day, eh, em, 0, 0);
  let candidate = new Date(utcGuess);
  const check = getLagosDateParts(candidate);
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.minutesSinceMidnight !== eh * 60 + em
  ) {
    const offsetMin = check.minutesSinceMidnight - (eh * 60 + em);
    candidate = new Date(candidate.getTime() - offsetMin * 60 * 1000);
  }
  return candidate;
}

const MAX_SNAP_FORWARD_DAYS = 60;

/**
 * Move hireEnd forward to the next valid return instant in WAT, then canonicalize.
 */
export function snapHireEndToReturnWindow(
  hireEnd: Date,
  window: HireReturnWindow,
  pricingPeriod: HirePricingPeriod,
): Date {
  if (isHireEndAllowed(hireEnd, window, pricingPeriod)) {
    return resolveCanonicalHireEnd(hireEnd, window, pricingPeriod);
  }

  for (let offset = 0; offset <= MAX_SNAP_FORWARD_DAYS; offset++) {
    const probe = new Date(hireEnd.getTime() + offset * 86400000);
    const parts = getLagosDateParts(probe);
    if (!window.daysOfWeek.includes(parts.dayOfWeek)) {
      continue;
    }

    if (pricingPeriod === "hourly") {
      const candidate = lagosWallClockToDate(
        parts.year,
        parts.month,
        parts.day,
        window.timeEnd,
      );
      if (isHireEndAllowed(candidate, window, pricingPeriod)) {
        return candidate;
      }
      const startM = parseHmToMinutes(window.timeStart);
      const candidateStart = lagosWallClockToDate(
        parts.year,
        parts.month,
        parts.day,
        minutesToHm(startM),
      );
      if (isHireEndAllowed(candidateStart, window, pricingPeriod)) {
        return candidateStart;
      }
      continue;
    }

    const dayAnchor = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day),
    );
    const candidate = resolveCanonicalHireEnd(dayAnchor, window, pricingPeriod);
    if (isHireEndAllowed(candidate, window, pricingPeriod)) {
      return candidate;
    }
  }

  throw new Error("Could not snap hireEnd to return window within 60 days");
}

function minutesToHm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
