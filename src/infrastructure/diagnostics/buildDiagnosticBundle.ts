import { ERYA_TABLES } from "../database/EryaDatabase";

const SAFE_ERROR_CODES = new Set([
  "schema-incompatible",
  "invalid-metadata",
  "database-open-failed",
]);
const SAFE_TABLE_NAMES = new Set<string>(ERYA_TABLES);
const SAFE_MODULE_IDS = new Set([
  "bazi_wuxing",
  "zodiac",
  "traditional",
  "name_hexagram",
  "five_grids",
]);
const SAFE_RUN_STATUSES = new Set(["running", "completed", "failed", "cancelled"]);
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/;

export interface DiagnosticRulePackInput {
  moduleId: string;
  checksum: string;
}

export interface DiagnosticAssessmentRunInput {
  status: string;
  configRevision: number;
  completed: number;
  total: number;
}

export interface DiagnosticBundleInput {
  appVersion: string;
  databaseVersion: number;
  errors: readonly string[];
  counts: Readonly<Record<string, number>>;
  rulePacks?: readonly DiagnosticRulePackInput[];
  recentAssessmentRun?: DiagnosticAssessmentRunInput;
}

export function buildDiagnosticBundle(input: DiagnosticBundleInput) {
  const rulePacks = sanitizeRulePacks(input.rulePacks ?? []);
  const recentAssessmentRun = sanitizeAssessmentRun(input.recentAssessmentRun);

  return {
    format: "erya-names-diagnostic" as const,
    appVersion: SEMVER_PATTERN.test(input.appVersion) ? input.appVersion : "unknown",
    databaseVersion: toNonNegativeInteger(input.databaseVersion) ?? 0,
    errors: sanitizeErrors(input.errors),
    counts: sanitizeCounts(input.counts),
    ...(rulePacks.length ? { rulePacks } : {}),
    ...(recentAssessmentRun ? { recentAssessmentRun } : {}),
  };
}

function sanitizeErrors(errors: readonly string[]): string[] {
  const sanitized = errors.map((error) => {
    if (SAFE_ERROR_CODES.has(error)) return error;
    const [prefix, tableName, ...remainder] = error.split(":");
    if (
      prefix === "missing-table" &&
      remainder.length === 0 &&
      tableName !== undefined &&
      SAFE_TABLE_NAMES.has(tableName)
    )
      return `missing-table:${tableName}`;
    return "unknown-error";
  });
  return [...new Set(sanitized)];
}

function sanitizeCounts(counts: Readonly<Record<string, number>>): Record<string, number> {
  const safeCounts: Record<string, number> = {};
  for (const tableName of ERYA_TABLES) {
    const count = toNonNegativeInteger(counts[tableName]);
    if (count !== undefined) safeCounts[tableName] = count;
  }
  return safeCounts;
}

function sanitizeRulePacks(
  rulePacks: readonly DiagnosticRulePackInput[],
): DiagnosticRulePackInput[] {
  const seen = new Set<string>();
  const safeRulePacks: DiagnosticRulePackInput[] = [];
  for (const { moduleId, checksum } of rulePacks) {
    const key = `${moduleId}:${checksum}`;
    if (seen.has(key) || !SAFE_MODULE_IDS.has(moduleId) || !CHECKSUM_PATTERN.test(checksum))
      continue;
    seen.add(key);
    safeRulePacks.push({ moduleId, checksum });
  }
  return safeRulePacks;
}

function sanitizeAssessmentRun(
  run: DiagnosticAssessmentRunInput | undefined,
): DiagnosticAssessmentRunInput | undefined {
  if (
    !run ||
    !SAFE_RUN_STATUSES.has(run.status) ||
    !isNonNegativeInteger(run.configRevision) ||
    !isNonNegativeInteger(run.completed) ||
    !isNonNegativeInteger(run.total) ||
    run.completed > run.total ||
    (run.status === "completed" && run.completed !== run.total)
  )
    return undefined;
  return {
    status: run.status,
    configRevision: run.configRevision,
    completed: run.completed,
    total: run.total,
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function toNonNegativeInteger(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}
