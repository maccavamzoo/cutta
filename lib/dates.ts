/**
 * Timezone-aware date helpers using native Intl (no external libraries).
 * Node 18+ supports full IANA timezone names via Intl.DateTimeFormat.
 */

export function getUserToday(timezone: string | null): {
  todayStr:   string;
  todayStart: Date;
  todayEnd:   Date;
} {
  const tz  = timezone ?? "Europe/London";
  const now = new Date();

  // YYYY-MM-DD in the user's local timezone
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);

  // Find the UTC instant that corresponds to midnight on todayStr in the user's tz.
  // Strategy: interpret todayStr+"T00:00:00Z" as a reference UTC point, then
  // measure how much the tz is offset from UTC at that instant, and shift accordingly.
  const refUtc  = new Date(todayStr + "T00:00:00Z");
  // "What time does refUtc appear as in UTC?" (should equal refUtc itself)
  const asUtc   = new Date(refUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  // "What time does refUtc appear as in the user's tz?"
  const asTz    = new Date(refUtc.toLocaleString("en-US", { timeZone: tz }));
  // offsetMs > 0  → tz is behind UTC (e.g. America/New_York in winter: +5h)
  // offsetMs < 0  → tz is ahead of UTC (e.g. Asia/Tokyo: -9h)
  const offsetMs = asUtc.getTime() - asTz.getTime();

  const todayStart = new Date(refUtc.getTime() + offsetMs);
  const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  return { todayStr, todayStart, todayEnd };
}

// Shared helper: given a YYYY-MM-DD string, return the UTC instant that is
// midnight on that date in the given timezone.
function midnightUtc(dateStr: string, tz: string): Date {
  const refUtc = new Date(dateStr + "T00:00:00Z");
  const asUtc  = new Date(refUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const asTz   = new Date(refUtc.toLocaleString("en-US", { timeZone: tz }));
  const offsetMs = asUtc.getTime() - asTz.getTime();
  return new Date(refUtc.getTime() + offsetMs);
}

export function getMonthBounds(timezone: string | null, monthStr: string): {
  monthStart: Date;
  monthEnd:   Date;
} {
  const tz = timezone ?? "Europe/London";

  // First day of the given month
  const monthStart = midnightUtc(`${monthStr}-01`, tz);

  // First day of the next month — parse year/month and increment
  const [year, month] = monthStr.split("-").map(Number);
  const nextYear  = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  const monthEnd = midnightUtc(`${nextMonthStr}-01`, tz);

  return { monthStart, monthEnd };
}

export function getDayBounds(timezone: string | null, dateStr: string): {
  dayStart: Date;
  dayEnd:   Date;
} {
  const tz       = timezone ?? "Europe/London";
  const dayStart = midnightUtc(dateStr, tz);
  const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd };
}
