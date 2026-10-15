import type { CandidateWarningEvidence } from "../../application/models/CandidateFunnelItem";
import type { FinalReportSource } from "../../application/models/FinalReportModel";
import type { ReportRepository } from "../../application/ports/ReportRepository";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieReportRepository implements ReportRepository {
  constructor(private readonly database: EryaDatabase) {}

  async buildFinalReport(projectId: string) {
    const [project, profile, decision, candidateDecisions, evaluations] = await Promise.all([
      this.database.projects.get(projectId),
      this.database.profiles.get(projectId),
      this.database.finalDecisions.get(projectId),
      this.database.candidateDecisions
        .where("[projectId+stage]")
        .equals([projectId, "finalist"])
        .toArray(),
      this.database.candidateEvaluations.where("projectId").equals(projectId).toArray(),
    ]);
    if (!project || !profile) return undefined;
    const candidateIds = candidateDecisions.map((item) => item.candidateId);
    const [candidates, sources, rules] = await Promise.all([
      this.database.candidates.bulkGet(candidateIds),
      this.database.candidateSources.where("candidateId").anyOf(candidateIds).toArray(),
      this.database.ruleResults.where("candidateId").anyOf(candidateIds).toArray(),
    ]);
    const evaluationMap = new Map(evaluations.map((item) => [item.candidateId, item]));

    return {
      profile,
      projectTitle: project.title,
      selectedCandidateId: decision?.selectedCandidateId ?? "",
      rationale: decision?.rationale ?? "尚未指定唯一首选，保留以下定稿名单。",
      privateData: {
        avoidCharacters: profile.avoidCharacters,
        ...(profile.folklore.birthLocalDateTime !== undefined
          ? { birthLocalDateTime: profile.folklore.birthLocalDateTime }
          : {}),
      },
      folkloreEnabled: profile.folklore.enabled,
      finalists: candidates.flatMap((candidate) => {
        if (!candidate) return [];
        const record = candidate as typeof candidate & {
          fullName?: string;
          pinyin?: string[];
          summary?: string;
        };
        const evaluation = evaluationMap.get(candidate.id);
        return [
          {
            id: candidate.id,
            givenName: candidate.givenName,
            characterEvidence: candidate.characterEvidence ?? [],
            fullName: record.fullName ?? candidate.normalizedFingerprint,
            pinyin: record.pinyin ?? [],
            summary: record.summary ?? "",
            sources: sources
              .filter((source) => source.candidateId === candidate.id)
              .map((source): FinalReportSource => ({
                sourceId: source.sourceId,
                ...(source.url ? { url: source.url } : {}),
                ...(source.revision ? { revision: source.revision } : {}),
                ...(source.title !== undefined ? { title: source.title } : {}),
                ...(source.work !== undefined ? { work: source.work } : {}),
                ...(source.quote !== undefined ? { quote: source.quote } : {}),
                ...(source.location !== undefined ? { location: source.location } : {}),
                ...(source.excerpt !== undefined ? { excerpt: source.excerpt } : {}),
              })),
            warnings: rules
              .filter((rule) => rule.candidateId === candidate.id && rule.outcome === "warn")
              .map((rule): CandidateWarningEvidence => ({
                ruleId: rule.ruleId,
                ruleVersion: rule.ruleVersion,
                explanation: rule.explanation,
                sourceRefs: rule.sourceRefs,
              })),
            ...(evaluation?.rating !== undefined ? { rating: evaluation.rating } : {}),
            ...(evaluation?.note !== undefined ? { note: evaluation.note } : {}),
          },
        ];
      }),
    };
  }
}
