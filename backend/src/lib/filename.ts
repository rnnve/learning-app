export function decodeFilename(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
