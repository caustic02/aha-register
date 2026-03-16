/**
 * Relative date formatting — no external dependencies.
 * Returns a human-readable relative string like "2 days ago" or "just now".
 * Falls back to a locale date string for dates older than 30 days.
 */
export function formatRelativeDate(dateString: string): string {
  let date: Date;
  try {
    date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
  } catch {
    return dateString;
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return diffMin === 1 ? '1 min ago' : `${diffMin} min ago`;
  if (diffHour < 24) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: diffDay > 365 ? 'numeric' : undefined,
  });
}
