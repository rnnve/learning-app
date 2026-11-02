/** iOS multipart filenames may arrive percent-encoded. Decode names, not arbitrary content. */
export function decodeDisplayName(value: string): string {
  try {
    return /%[0-9a-f]{2}/i.test(value) ? decodeURIComponent(value) : value;
  } catch {
    return value;
  }
}

export function normalizeDisplayNames<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalizeDisplayNames) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      (key === "title" || key === "filename") && typeof item === "string"
        ? decodeDisplayName(item)
        : key === "originalFilenames" && Array.isArray(item)
          ? item.map((name) => (typeof name === "string" ? decodeDisplayName(name) : name))
          : normalizeDisplayNames(item),
    ]),
  ) as T;
}
