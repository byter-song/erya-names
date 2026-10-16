import type { CandidateSourceEvidence } from "../../domain/candidate/sourceEvidence";
import type { NamingProfile } from "../../domain/project/profile";
import type { CandidateScore } from "../../domain/rules/candidateScore";
import type { EvidenceStatus, RuleEvidence, RuleModuleId } from "../../domain/rules/result";

export type SelectedNamesExportMode = "share" | "personal";
export type SelectedNamesExportFormat = "print" | "json";

/** One visibility policy is shared by preview, print and JSON output. */
export interface SelectedNamesExportVisibility {
  birthData: boolean;
  fourPillars: boolean;
  relatives: boolean;
  zodiacDetails: boolean;
  notes: boolean;
}

export const selectedNamesExportVisibility: Readonly<
  Record<SelectedNamesExportMode, SelectedNamesExportVisibility>
> = {
  share: {
    birthData: false,
    fourPillars: false,
    relatives: false,
    zodiacDetails: false,
    notes: false,
  },
  personal: {
    birthData: true,
    fourPillars: true,
    relatives: true,
    zodiacDetails: true,
    notes: true,
  },
};

export interface SelectedNamesHardRisk {
  moduleId: RuleModuleId;
  ruleId: string;
  status: EvidenceStatus;
  explanation: string;
}

export interface SelectedNamesExportScore {
  hardStatus: CandidateScore["hardStatus"];
  totalScore?: number;
  completeness: number;
  moduleScores: CandidateScore["moduleScores"];
  topDeductions: CandidateScore["topDeductions"];
  hiddenScoredModuleCount: number;
}

export interface SelectedNamesExportCandidate {
  id: string;
  givenName: string;
  fullName: string;
  pinyin: string[];
  summary: string;
  sources: CandidateSourceEvidence[];
  hardStatus: CandidateScore["hardStatus"];
  hardRisks: SelectedNamesHardRisk[];
  evidence: RuleEvidence[];
  score?: SelectedNamesExportScore;
  evaluation?: { rating?: number; note?: string };
}

export interface SelectedNamesPrivateData {
  birth?: {
    localDateTime: string;
    timeKnown: boolean;
    timeZone: string;
    dayBoundary: NamingProfile["calendar"]["dayBoundary"];
  };
  fourPillars?: string[];
  zodiacDetails?: {
    lunar?: string;
    pillar?: string;
    convention: NamingProfile["calendar"]["zodiacConvention"];
  };
  relatives: {
    names: string[];
    avoidances: NonNullable<NamingProfile["family"]["relativeAvoidances"]>;
  };
  notes: {
    dialect?: string;
    usefulGod?: string;
  };
}

export interface SelectedNamesExport {
  schema: "erya-selected-names-export";
  schemaVersion: 1;
  mode: SelectedNamesExportMode;
  format: SelectedNamesExportFormat;
  generatedAt: string;
  project: {
    id: string;
    title: string;
    surname: string;
    configRevision: number;
  };
  visibility: SelectedNamesExportVisibility;
  disclaimer: "按方案所选传统体系与流派计算；结论会随口径和资料完整度变化。";
  candidates: SelectedNamesExportCandidate[];
  privateData?: SelectedNamesPrivateData;
}

export interface SelectedNamesExportPreview {
  mode: SelectedNamesExportMode;
  availableCount: number;
  selectedCount: number;
  candidateIds: string[];
  candidateNames: string[];
  hardRiskCount: number;
  visibility: SelectedNamesExportVisibility;
  requiresPersonalConfirmation: boolean;
}

export type SelectedNamesExportError =
  "project-not-found" | "candidate-not-selected" | "personal-export-confirmation-required";

export function isSelectedNamesExport(value: unknown): value is SelectedNamesExport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SelectedNamesExport>;
  return candidate.schema === "erya-selected-names-export" && candidate.schemaVersion === 1;
}
