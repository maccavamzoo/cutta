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
