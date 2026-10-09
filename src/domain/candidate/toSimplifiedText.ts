export function toSimplifiedText(
  value: string,
  mappings: Readonly<Record<string, string>>,
): string {
  return [...value.normalize("NFC")].map((char) => mappings[char] ?? char).join("");
}
