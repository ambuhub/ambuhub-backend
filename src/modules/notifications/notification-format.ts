const LAGOS_TZ = "Africa/Lagos";

export function formatDeadlineWat(deadline: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: LAGOS_TZ,
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(deadline);
}
