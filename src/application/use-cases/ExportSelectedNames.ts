import type { CandidateDetail } from "../models/CandidateDetail";
import type { CandidateFunnelItem } from "../models/CandidateFunnelItem";
import {
  selectedNamesExportVisibility,
  type SelectedNamesExport,
  type SelectedNamesExportCandidate,
  type SelectedNamesExportError,
  type SelectedNamesExportFormat,
  type SelectedNamesExportMode,
  type SelectedNamesExportPreview,
  type SelectedNamesHardRisk,
  type SelectedNamesPrivateData,
} from "../models/SelectedNamesExport";
import type { ProjectWorkspace } from "../ports/ProjectRepository";
import { calculateBasicFiveElements } from "../../domain/folklore/calendarAdapter";
import type { RuleEvidence } from "../../domain/rules/result";
import { err, ok, type Result } from "../../domain/shared/result";

interface WorkspaceQuery {
  execute(projectId: string): Promise<Result<ProjectWorkspace, string>>;
}

interface FunnelQuery {
  execute(projectId: string, pools?: Array<"selected">): Promise<CandidateFunnelItem[]>;
}

interface CandidateDetailQuery {
  execute(projectId: string, candidateId: string): Promise<CandidateDetail | undefined>;
}

interface ExportSelectionInput {
  projectId: string;
  candidateIds?: string[];
  mode: SelectedNamesExportMode;
}

interface BuildSelectedNamesExportInput extends ExportSelectionInput {
  format: SelectedNamesExportFormat;
  personalDataConfirmed?: boolean;
}

/** Builds an export from the selected pool only. It never applies a finalist count limit. */
export class ExportSelectedNames {
  constructor(
    private readonly workspaces: WorkspaceQuery,
    private readonly funnel: FunnelQuery,
    private readonly details: CandidateDetailQuery,
    private readonly dependencies: { now: () => string } = {
      now: () => new Date().toISOString(),
    },
  ) {}

  async preview(
    input: ExportSelectionInput,
  ): Promise<Result<SelectedNamesExportPreview, SelectedNamesExportError>> {
    const resolved = await this.resolve(input);
    if (!resolved.ok) return resolved;
    const hardRiskCount = resolved.value.candidates.reduce(
      (total, candidate) => total + hardRisks(candidate, []).length,
      0,
    );
    return ok({
      mode: input.mode,
      availableCount: resolved.value.allSelected.length,
      selectedCount: resolved.value.candidates.length,
      candidateIds: resolved.value.candidates.map(({ id }) => id),
      candidateNames: resolved.value.candidates.map(({ fullName }) => fullName),
      hardRiskCount,
      visibility: selectedNamesExportVisibility[input.mode],
      requiresPersonalConfirmation: input.mode === "personal",
    });
  }

  async build(
    input: BuildSelectedNamesExportInput,
  ): Promise<Result<SelectedNamesExport, SelectedNamesExportError>> {
    if (input.mode === "personal" && input.personalDataConfirmed !== true)
      return err("personal-export-confirmation-required");

    const resolved = await this.resolve(input);
    if (!resolved.ok) return resolved;
    const detailRecords = await Promise.all(
      resolved.value.candidates.map((candidate) =>
        this.details.execute(input.projectId, candidate.id),
      ),
    );
    const candidates = resolved.value.candidates.map((candidate, index) =>
      exportCandidate(
        candidate,
        detailRecords[index]?.evidence ?? [],
        input.mode,
        resolved.value.workspace.profile,
      ),
    );
    const profile = resolved.value.workspace.profile;
    const document: SelectedNamesExport = {
      schema: "erya-selected-names-export",
      schemaVersion: 1,
      mode: input.mode,
      format: input.format,
      generatedAt: this.dependencies.now(),
      project: {
        id: input.projectId,
        title: resolved.value.workspace.project.title,
        surname: profile.basics.surname,
        configRevision: profile.configRevision,
      },
      visibility: selectedNamesExportVisibility[input.mode],
      disclaimer: "按方案所选传统体系与流派计算；结论会随口径和资料完整度变化。",
      candidates,
      ...(input.mode === "personal" ? { privateData: buildPrivateData(profile) } : {}),
    };
    return ok(document);
  }

  private async resolve(input: ExportSelectionInput): Promise<
    Result<
      {
        workspace: ProjectWorkspace;
        allSelected: CandidateFunnelItem[];
        candidates: CandidateFunnelItem[];
      },
      SelectedNamesExportError
    >
  > {
    const [workspace, allSelected] = await Promise.all([
      this.workspaces.execute(input.projectId),
      this.funnel.execute(input.projectId, ["selected"]),
    ]);
    if (!workspace.ok) return err("project-not-found");

    if (input.candidateIds === undefined)
      return ok({ workspace: workspace.value, allSelected, candidates: allSelected });

    const requestedIds = [...new Set(input.candidateIds)];
    const selectedById = new Map(allSelected.map((candidate) => [candidate.id, candidate]));
    if (requestedIds.some((candidateId) => !selectedById.has(candidateId)))
      return err("candidate-not-selected");
    return ok({
      workspace: workspace.value,
      allSelected,
      candidates: requestedIds.flatMap((candidateId) => {
        const candidate = selectedById.get(candidateId);
        return candidate ? [candidate] : [];
      }),
    });
  }
}

function exportCandidate(
  candidate: CandidateFunnelItem,
  evidence: RuleEvidence[],
  mode: SelectedNamesExportMode,
  profile: ProjectWorkspace["profile"],
): SelectedNamesExportCandidate {
  const risks = hardRisks(candidate, evidence).map((risk) =>
    mode === "share" ? redactHardRisk(risk) : risk,
  );
  const visibleEvidence = evidence.filter((item) => {
    if (item.severity === "hard" && item.status === "conflict") return true;
    if (item.moduleId === "basic") return true;
    if (!profile.modules[item.moduleId].detailsVisible) return false;
    return mode === "personal" || !["bazi_wuxing", "zodiac"].includes(item.moduleId);
  });
  return {
    id: candidate.id,
    givenName: candidate.givenName ?? candidate.fullName.slice(profile.basics.surname.length),
    fullName: candidate.fullName,
    pinyin: candidate.pinyin,
    summary: candidate.summary,
    sources: candidate.sourceEvidence,
    hardStatus: candidate.hardStatus,
    hardRisks: risks,
    evidence: mode === "share" ? visibleEvidence.map(redactEvidence) : visibleEvidence,
    ...(candidate.totalScore !== undefined
      ? {
          score: {
            hardStatus: candidate.hardStatus,
            totalScore: candidate.totalScore,
            completeness: candidate.completeness,
            hiddenScoredModuleCount: candidate.hiddenScoredModuleCount,
            moduleScores: candidate.moduleScores,
            topDeductions: candidate.topDeductions,
          },
        }
      : {}),
    ...(candidate.rating !== undefined || (mode === "personal" && candidate.note !== undefined)
      ? {
          evaluation: {
            ...(candidate.rating !== undefined ? { rating: candidate.rating } : {}),
            ...(mode === "personal" && candidate.note !== undefined
              ? { note: candidate.note }
              : {}),
          },
        }
      : {}),
  };
}

function redactHardRisk(risk: SelectedNamesHardRisk): SelectedNamesHardRisk {
  if (risk.ruleId.includes("family"))
    return { ...risk, explanation: "命中家庭硬性约束（亲属与避讳细节已隐藏）。" };
  if (risk.moduleId === "bazi_wuxing")
    return { ...risk, explanation: "命中八字五行硬性风险（出生与四柱细节已隐藏）。" };
  if (risk.moduleId === "zodiac")
    return { ...risk, explanation: "命中生肖硬性风险（生肖明细已隐藏）。" };
  return risk;
}

function hardRisks(
  candidate: CandidateFunnelItem,
  evidence: RuleEvidence[],
): SelectedNamesHardRisk[] {
  const risks = evidence
    .filter(({ severity, status }) => severity === "hard" && status === "conflict")
    .map(({ moduleId, ruleId, status, explanation }) => ({
      moduleId,
      ruleId,
      status,
      explanation,
    }));
  if (candidate.hardStatus === "conflict" && risks.length === 0)
    risks.push({
      moduleId: "basic",
      ruleId: "current-hard-status",
      status: "conflict",
      explanation: "存在硬性风险，请回到本地项目核对完整规则证据。",
    });
  return risks;
}

function redactEvidence(evidence: RuleEvidence): RuleEvidence {
  if (evidence.ruleId.includes("family"))
    return {
      ...evidence,
      explanation: "家庭约束已核对，亲属与避讳细节已隐藏。",
      inputSummary: "家庭约束输入已隐藏",
      calculation: [],
    };
  return { ...evidence, inputSummary: "导出输入摘要已隐藏", calculation: [] };
}

function buildPrivateData(profile: ProjectWorkspace["profile"]): SelectedNamesPrivateData {
  const privateData: SelectedNamesPrivateData = {
    relatives: {
      names: [...profile.family.relativeNames],
      avoidances: [...(profile.family.relativeAvoidances ?? [])],
    },
    notes: {
      ...(profile.basics.dialectNotes ? { dialect: profile.basics.dialectNotes } : {}),
      ...(profile.usefulGodDecision?.note ? { usefulGod: profile.usefulGodDecision.note } : {}),
    },
  };
  const localDateTime = profile.calendar.birthLocalDateTime;
  if (!localDateTime) return privateData;
  privateData.birth = {
    localDateTime,
    timeKnown: profile.calendar.timeKnown,
    timeZone: profile.calendar.timeZone,
    dayBoundary: profile.calendar.dayBoundary,
  };
  try {
    const calendar = calculateBasicFiveElements({
      localDateTime,
      timeKnown: profile.calendar.timeKnown,
      timeZone: profile.calendar.timeZone,
      dayBoundary: profile.calendar.dayBoundary,
    });
    privateData.fourPillars = calendar.pillars;
    privateData.zodiacDetails = {
      lunar: calendar.lunarZodiac,
      pillar: calendar.pillarZodiac,
      convention: profile.calendar.zodiacConvention,
    };
  } catch {
    // The original birth input remains available in personal mode; a failed calendar
    // calculation must not invent pillars or zodiac details.
  }
  return privateData;
}
