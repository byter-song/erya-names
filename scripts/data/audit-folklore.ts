import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type FolkloreModuleId =
  "bazi_wuxing" | "zodiac" | "traditional" | "name_hexagram" | "five_grids";

export type FolkloreSourceRecord = {
  id: string;
  title: string;
  locator: string;
  pageOrSection: string;
  verificationStatus: "unverified" | "image_checked" | "official";
  notes?: string;
};

export type FolkloreRulePackManifest = {
  moduleId: FolkloreModuleId;
  schoolId: string;
  ruleVersion: string;
  reviewStatus: "research_only" | "reviewed";
  /** Product readiness; this does not make a folklore conclusion objective truth. */
  epistemicStatus?:
    | "calculation_convention"
    | "research_model"
    | "school_specific"
    | "historical_context"
    | "source_gap";
  uncertainty?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  sourceIds: string[];
  applicableInputs: string[];
  checksum: string;
  sources: FolkloreSourceRecord[];
};

export type FolkloreAuditIssue = {
  code:
    | "duplicate-pack-version"
    | "invalid-checksum"
    | "missing-source"
    | "invalid-review"
    | "invalid-inputs"
    | "missing-default-pack"
    | "research-only-default"
    | "checksum-mismatch"
    | "invalid-rule-document"
    | "unsafe-zodiac-behavior"
    | "unsafe-traditional-behavior"
    | "invalid-deduction-cap"
    | "missing-controversy"
    | "principle-deduction"
    | "invalid-rule-source";
  packId: string;
  message: string;
};

const checksumPattern = /^sha256:[a-f0-9]{64}$/;

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asObjectArray = (value: unknown): JsonObject[] =>
  Array.isArray(value) ? value.filter(isObject) : [];

const issue = (
  code: FolkloreAuditIssue["code"],
  manifest: FolkloreRulePackManifest,
  message: string,
): FolkloreAuditIssue => ({ code, packId: folklorePackId(manifest), message });

export const folklorePackId = (manifest: FolkloreRulePackManifest) =>
  `${manifest.moduleId}/${manifest.schoolId}/${manifest.ruleVersion}`;

export function auditFolkloreRulePacks(input: {
  manifests: FolkloreRulePackManifest[];
  defaultPresetPackIds: string[];
}) {
  const issues: FolkloreAuditIssue[] = [];
  const seen = new Set<string>();
  const byId = new Map<string, FolkloreRulePackManifest>();

  for (const manifest of input.manifests) {
    const packId = folklorePackId(manifest);
    if (seen.has(packId)) {
      issues.push({
        code: "duplicate-pack-version",
        packId,
        message: `Duplicate folklore pack tuple: ${packId}`,
      });
    }
    seen.add(packId);
    byId.set(packId, manifest);

    if (!checksumPattern.test(manifest.checksum)) {
      issues.push({
        code: "invalid-checksum",
        packId,
        message: "Checksum must be sha256:<64 hex>.",
      });
    }
    if (
      manifest.applicableInputs.length === 0 ||
      new Set(manifest.applicableInputs).size !== manifest.applicableInputs.length
    ) {
      issues.push({
        code: "invalid-inputs",
        packId,
        message: "Applicable inputs must be non-empty and unique.",
      });
    }

    const sourceIds = new Set(manifest.sources.map((source) => source.id));
    const missingSource =
      manifest.sources.length === 0 ||
      manifest.sourceIds.length === 0 ||
      manifest.sourceIds.some((sourceId) => !sourceIds.has(sourceId)) ||
      manifest.sources.some((source) => !source.pageOrSection.trim());
    if (missingSource) {
      issues.push({
        code: "missing-source",
        packId,
        message: "Every source id needs a page or section record.",
      });
    }

    if (
      manifest.reviewStatus === "reviewed" &&
      (!manifest.reviewedAt ||
        !manifest.reviewedBy ||
        !manifest.epistemicStatus ||
        !manifest.uncertainty?.trim() ||
        manifest.sources.every((source) => source.verificationStatus === "unverified"))
    ) {
      issues.push({
        code: "invalid-review",
        packId,
        message:
          "Reviewed packs require reviewer, date, epistemic status, uncertainty and at least one checked source.",
      });
    }
  }

  for (const packId of input.defaultPresetPackIds) {
    const manifest = byId.get(packId);
    if (!manifest) {
      issues.push({
        code: "missing-default-pack",
        packId,
        message: "Default preset references a missing pack.",
      });
    } else if (manifest.reviewStatus !== "reviewed") {
      issues.push({
        code: "research-only-default",
        packId,
        message: "Research-only packs cannot enter defaults.",
      });
    }
  }

  return { ok: issues.length === 0, packCount: input.manifests.length, issues };
}

/**
 * Audit module-specific safety invariants that cannot be expressed by the
 * shared manifest schema. These checks keep cultural references traceable and
 * prevent advisory folklore data from becoming a generation gate.
 */
export function auditFolkloreRuleDocument(
  manifest: FolkloreRulePackManifest,
  document: unknown,
): FolkloreAuditIssue[] {
  if (!isObject(document)) {
    return [issue("invalid-rule-document", manifest, "Rule document must be an object.")];
  }

  if (manifest.moduleId === "zodiac") {
    const behavior = isObject(document.behavior) ? document.behavior : {};
    const scoring = isObject(document.scoring) ? document.scoring : {};
    const rules = asObjectArray(document.rules);
    const issues: FolkloreAuditIssue[] = [];

    if (
      behavior.adviceOnly !== true ||
      behavior.filtersCandidates !== false ||
      behavior.blocksProgression !== false ||
      behavior.emitsHardConflict !== false
    ) {
      issues.push(
        issue(
          "unsafe-zodiac-behavior",
          manifest,
          "Zodiac packs must be soft advice and must never filter, block progression or emit hard conflicts.",
        ),
      );
    }
    if (
      scoring.avoidDeduction !== 8 ||
      scoring.preferBonus !== 0 ||
      scoring.moduleDeductionCap !== 20 ||
      typeof scoring.maximumCompositeWeightPercent !== "number" ||
      scoring.maximumCompositeWeightPercent > 10
    ) {
      issues.push(
        issue(
          "invalid-deduction-cap",
          manifest,
          "Zodiac scoring must use 8-point avoid hints, zero positive bonus and a 20-point cap.",
        ),
      );
    }
    if (rules.length === 0) {
      issues.push(issue("invalid-rule-document", manifest, "Zodiac packs require rules."));
    }
    if (new Set(rules.map((rule) => rule.zodiac)).size !== 12) {
      issues.push(
        issue(
          "invalid-rule-document",
          manifest,
          "Zodiac packs must explicitly cover all twelve zodiac animals.",
        ),
      );
    }
    for (const rule of rules) {
      if (
        !["disputed", "school_specific", "contextual"].includes(
          typeof rule.controversyStatus === "string" ? rule.controversyStatus : "",
        ) ||
        typeof rule.controversyNote !== "string" ||
        !rule.controversyNote.trim()
      ) {
        issues.push(
          issue(
            "missing-controversy",
            manifest,
            `Zodiac rule ${String(rule.id ?? "<unknown>")} needs an explicit controversy status and note.`,
          ),
        );
      }
      if (typeof rule.sourceId !== "string" || !manifest.sourceIds.includes(rule.sourceId)) {
        issues.push(
          issue(
            "invalid-rule-source",
            manifest,
            `Zodiac rule ${String(rule.id ?? "<unknown>")} references an unknown source.`,
          ),
        );
      }
      const ruleSource = manifest.sources.find(({ id }) => id === rule.sourceId);
      if (rule.reviewStatus === "reviewed" && ruleSource?.verificationStatus === "unverified") {
        issues.push(
          issue(
            "invalid-rule-source",
            manifest,
            `Reviewed zodiac rule ${String(rule.id ?? "<unknown>")} must use a checked source.`,
          ),
        );
      }
      const expectedDeduction = rule.direction === "avoid" ? 8 : 0;
      if (
        rule.deduction !== expectedDeduction ||
        !["reviewed", "research_only"].includes(String(rule.reviewStatus ?? "")) ||
        !Array.isArray(rule.characters) ||
        rule.characters.length === 0
      ) {
        issues.push(
          issue(
            "invalid-rule-document",
            manifest,
            `Zodiac rule ${String(rule.id ?? "<unknown>")} has an invalid deduction.`,
          ),
        );
      }
    }
    return issues;
  }

  if (manifest.moduleId === "traditional") {
    const behavior = isObject(document.behavior) ? document.behavior : {};
    const scoring = isObject(document.scoring) ? document.scoring : {};
    const principles = asObjectArray(document.principles);
    const taboos = asObjectArray(document.taboos);
    const issues: FolkloreAuditIssue[] = [];

    if (
      behavior.adviceOnly !== true ||
      behavior.filtersCandidates !== false ||
      behavior.blocksProgression !== false ||
      behavior.emitsHardConflict !== false ||
      behavior.familyAvoidanceHandledElsewhere !== true
    ) {
      issues.push(
        issue(
          "unsafe-traditional-behavior",
          manifest,
          "Traditional naming packs must remain soft advice and must delegate family avoidances.",
        ),
      );
    }

    if (
      scoring.principleDeduction !== 0 ||
      scoring.tabooDeduction !== 5 ||
      scoring.moduleDeductionCap !== 15 ||
      typeof scoring.maximumCompositeWeightPercent !== "number" ||
      scoring.maximumCompositeWeightPercent > 15
    ) {
      issues.push(
        issue(
          "invalid-deduction-cap",
          manifest,
          "Traditional naming scoring must use 5 points per literal taboo and a 15-point cap.",
        ),
      );
    }
    if (principles.length !== 5 || taboos.length !== 6) {
      issues.push(
        issue(
          "invalid-rule-document",
          manifest,
          "Traditional naming packs require exactly five principles and six taboo categories.",
        ),
      );
    }
    for (const principle of principles) {
      if (
        principle.deduction !== 0 ||
        principle.kind !== "interpretation_tag" ||
        !["reviewed", "research_only"].includes(String(principle.reviewStatus ?? ""))
      ) {
        issues.push(
          issue(
            "principle-deduction",
            manifest,
            `Principle ${String(principle.id ?? "<unknown>")} must remain a zero-deduction interpretation tag.`,
          ),
        );
      }
      if (
        typeof principle.sourceId !== "string" ||
        !manifest.sourceIds.includes(principle.sourceId)
      ) {
        issues.push(
          issue(
            "invalid-rule-source",
            manifest,
            `Principle ${String(principle.id ?? "<unknown>")} references an unknown source.`,
          ),
        );
      }
    }
    for (const taboo of taboos) {
      if (
        taboo.deduction !== 5 ||
        taboo.matchMode !== "explicit_term" ||
        !Array.isArray(taboo.terms) ||
        taboo.terms.length === 0 ||
        !["reviewed", "research_only"].includes(String(taboo.reviewStatus ?? "")) ||
        typeof taboo.controversyStatus !== "string" ||
        typeof taboo.controversyNote !== "string" ||
        !taboo.controversyNote.trim()
      ) {
        issues.push(
          issue(
            "missing-controversy",
            manifest,
            `Taboo ${String(taboo.id ?? "<unknown>")} needs a 5-point deduction and historical-context note.`,
          ),
        );
      }
      if (typeof taboo.sourceId !== "string" || !manifest.sourceIds.includes(taboo.sourceId)) {
        issues.push(
          issue(
            "invalid-rule-source",
            manifest,
            `Taboo ${String(taboo.id ?? "<unknown>")} references an unknown source.`,
          ),
        );
      }
    }
    return issues;
  }

  return [];
}

async function findManifestFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) return findManifestFiles(location);
      return entry.name === "manifest.json" ? [location] : [];
    }),
  );
  return nested.flat();
}

export async function auditFolkloreDirectory(directory = "data/sources/personal/folklore") {
  const manifestFiles = await findManifestFiles(directory);
  const packs = await Promise.all(
    manifestFiles.map(async (file) => {
      const manifest = JSON.parse(await readFile(file, "utf8")) as FolkloreRulePackManifest;
      const candidates = ["rules.json", "fixtures.json"].map((name) =>
        path.join(path.dirname(file), name),
      );
      for (const candidate of candidates) {
        try {
          const bytes = await readFile(candidate);
          return {
            manifest,
            bytes,
            document:
              path.basename(candidate) === "rules.json"
                ? (JSON.parse(bytes.toString("utf8")) as unknown)
                : undefined,
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      return { manifest, bytes: undefined, document: undefined };
    }),
  );
  const manifests = packs.map((pack) => pack.manifest);
  const presetPath = path.join(directory, "default-presets.json");
  let defaultPresetPackIds: string[] = [];
  try {
    const presets = JSON.parse(await readFile(presetPath, "utf8")) as { packIds?: string[] };
    defaultPresetPackIds = presets.packIds ?? [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const base = auditFolkloreRulePacks({ manifests, defaultPresetPackIds });
  const issues = [...base.issues];
  for (const pack of packs) {
    if (pack.bytes) {
      const actual = `sha256:${createHash("sha256").update(pack.bytes).digest("hex")}`;
      if (actual !== pack.manifest.checksum) {
        issues.push(
          issue(
            "checksum-mismatch",
            pack.manifest,
            `Manifest checksum ${pack.manifest.checksum} does not match ${actual}.`,
          ),
        );
      }
    }
    if (pack.document !== undefined) {
      issues.push(...auditFolkloreRuleDocument(pack.manifest, pack.document));
    }
  }
  return { ok: issues.length === 0, packCount: base.packCount, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await auditFolkloreDirectory();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
