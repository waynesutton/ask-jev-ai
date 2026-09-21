const GROUPED = new Intl.NumberFormat("en-US");

export function formatCount(n: number): string {
  return GROUPED.format(Math.max(0, Math.floor(n)));
}

// "0,000,412" split into dim leading zeros and the lit remainder.
export function odometer(
  n: number,
  digits: number,
): { dim: string; lit: string } {
  const padded = Math.max(0, Math.floor(n)).toString().padStart(digits, "0");
  const grouped = padded.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const firstNonZero = grouped.search(/[1-9]/);
  if (firstNonZero === -1) {
    return { dim: grouped.slice(0, -1), lit: grouped.slice(-1) };
  }
  return {
    dim: grouped.slice(0, firstNonZero),
    lit: grouped.slice(firstNonZero),
  };
}

export function percentOf(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const pct = (part / whole) * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(4)}%`;
}

// Jev costs fractions of a cent per message. Keep two significant digits
// below a cent so tiny numbers stay honest and readable.
export function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n >= 100) return `$${GROUPED.format(Math.round(n))}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${Number(n.toPrecision(2)).toString()}`;
}

// Stopwatch: "3d 04:12:09". Days only when there are any, so the first day
// reads as a plain clock.
export function stopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const hms = [hours, minutes, seconds]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");
  return days > 0 ? `${days}d ${hms}` : hms;
}

// Coarse remaining time: "~2y 41d", "~347d", "~6h", "~12m". Coarse on
// purpose so the estimate holds still between counts instead of jittering.
export function roughDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `~${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `~${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `~${days}d`;
  // Past a year the day count is noise and it widened the panel row. One
  // decimal under ten years, whole years after.
  const years = days / 365;
  if (years < 10) return `~${years.toFixed(1).replace(/\.0$/, "")}y`;
  return `~${Math.round(years)}y`;
}

export function timeAgo(ms: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - ms) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
