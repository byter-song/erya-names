import type { FolkloreModuleId, NamingProfile } from "./profile";

/** Hashes only inputs that can alter evidence or score. Display visibility and revision metadata are omitted. */
export async function scoringInputHash(profile: NamingProfile): Promise<string> {
  const modules = Object.fromEntries(
    (
      Object.entries(profile.modules) as Array<
        [FolkloreModuleId, NamingProfile["modules"][FolkloreModuleId]]
      >
    ).map(([moduleId, { analysisEnabled, weight, schoolId, ruleVersion }]) => [
      moduleId,
      { analysisEnabled, weight, schoolId, ruleVersion },
    ]),
  );
  const input = {
    basics: profile.basics,
    family: profile.family,
    calendar: profile.calendar,
    modules,
    scoring: { basicWeight: profile.scoring.basicWeight },
    usefulGodDecision: profile.usefulGodDecision ?? null,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(sortObject(input)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObject(item)]),
  );
}
