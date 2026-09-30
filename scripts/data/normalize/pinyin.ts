export function parsePinyinData(input: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const line of input.split(/\r?\n/u)) {
    const match = line.match(/^U\+([0-9A-F]+):\s*([^#]+?)\s*(?:#.*)?$/u);
    if (!match) continue;
    const point = Number.parseInt(match[1] ?? "", 16);
    const readings = (match[2] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (Number.isFinite(point) && readings.length)
      result.set(String.fromCodePoint(point), readings);
  }
  return result;
}
