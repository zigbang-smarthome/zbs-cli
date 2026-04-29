/**
 * Date range helpers.
 *
 * ZBS endpoints take YYYY-MM-DD (not timestamps). Sub-day units (h/m) are
 * floored to whole days because the API can't filter finer than that.
 */

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return isoDate(new Date());
}

/** Parse "Nd" / "Nh" / "Nm" into milliseconds. Hours/minutes still resolve to whole days. */
export function parseDuration(s: string): number {
  const m = s.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) throw new Error(`invalid duration: ${s} (expected e.g. 7d, 2h, 30m)`);
  const n = parseInt(m[1]!, 10);
  const unit = m[2]!.toLowerCase();
  const mult = unit === "d" ? 86400_000 : unit === "h" ? 3600_000 : unit === "m" ? 60_000 : 1000;
  return n * mult;
}

/**
 * Resolve --since (e.g. "7d") into a [from, to] pair where to=today.
 * Rounds the from-date down to the day boundary in local time.
 */
export function sinceRange(spec: string): { from: string; to: string } {
  const ms = parseDuration(spec);
  const from = new Date(Date.now() - ms);
  return { from: isoDate(from), to: today() };
}

export function explicitRange(from: string | undefined, to: string | undefined, fallbackSince: string): { from: string; to: string } {
  if (from && to) return { from, to };
  if (from && !to) return { from, to: today() };
  if (!from && to) return { from: to, to };
  return sinceRange(fallbackSince);
}
