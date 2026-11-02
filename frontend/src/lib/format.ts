export function formatDate(
  dateInput: string | number | Date,
  locale: "th" | "en" = "th",
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return "";

    const defaultOpts: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    };

    const targetLocale = locale === "th" ? "th-TH" : "en-US";
    return new Intl.DateTimeFormat(targetLocale, defaultOpts).format(date);
  } catch {
    const d = new Date(dateInput);
    return d.toISOString().split("T")[0] || "";
  }
}

export function formatDateTime(
  dateInput: string | number | Date,
  locale: "th" | "en" = "th",
): string {
  return formatDate(dateInput, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(value: number, locale: "th" | "en" = "th"): string {
  try {
    const targetLocale = locale === "th" ? "th-TH" : "en-US";
    return new Intl.NumberFormat(targetLocale).format(value);
  } catch {
    return String(value);
  }
}

export function formatPercent(value: number, locale: "th" | "en" = "th"): string {
  try {
    const targetLocale = locale === "th" ? "th-TH" : "en-US";
    return new Intl.NumberFormat(targetLocale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value * 100)}%`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / k ** i;
  return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
