export function nowIso(): string {
  return new Date().toISOString();
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getBangkokDateString(date: Date = new Date()): string {
  // Format as YYYY-MM-DD in Asia/Bangkok timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function getBangkokMidnightIso(date: Date = new Date()): string {
  const bkkDate = getBangkokDateString(date);
  // Bangkok is UTC+7
  const nextDay = new Date(`${bkkDate}T00:00:00+07:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.toISOString();
}
