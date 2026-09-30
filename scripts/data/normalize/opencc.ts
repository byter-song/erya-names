export function parseTraditionalToSimplified(input: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of input.split(/\r?\n/u)) {
    if (!line || line.startsWith("#")) continue;
    const [traditional, values] = line.split("\t");
    const simplified = values?.split(/\s+/u)[0];
    if (
      traditional &&
      simplified &&
      [...traditional].length === 1 &&
      [...simplified].length === 1
    )
      result.set(traditional, simplified);
  }
  return result;
}
