import type {
  ManualCandidateInput,
  ManualCandidateRepository,
} from "../../application/ports/ManualCandidateRepository";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieManualCandidateRepository implements ManualCandidateRepository {
  constructor(private readonly database: EryaDatabase) {}
  async exists(projectId: string, normalizedFingerprint: string): Promise<boolean> {
    return (
      (await this.database.candidates
        .where("[projectId+normalizedFingerprint]")
        .equals([projectId, normalizedFingerprint])
        .count()) > 0
    );
  }
  async save(input: ManualCandidateInput): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.candidates,
        this.database.candidateSources,
        this.database.ruleResults,
        this.database.candidateDecisions,
      ],
      async () => {
        await this.database.candidates.add({
          id: input.id,
          projectId: input.projectId,
          batchId: null,
          normalizedFingerprint: input.normalizedFingerprint,
          surname: input.surname,
          givenName: input.givenName,
          fullName: input.fullName,
          pinyin: input.pinyin,
          sourceType: "user_input",
          summary: input.summary,
          sourceIds: ["user-input"],
          sourceEvidence: [{ sourceId: "user-input", location: input.userSource }],
          warnings: [],
          riskSignals: input.riskSignals,
          ruleResults: input.ruleResults,
          styleTags: [],
          characterElements: [],
          characterEvidence: input.characterEvidence,
          createdAt: input.createdAt,
        });
        await this.database.candidateSources.add({
          id: `${input.id}:source:1`,
          projectId: input.projectId,
          candidateId: input.id,
          sourceId: "user-input",
          location: input.userSource,
        });
        await this.database.ruleResults.bulkAdd(
          input.ruleResults.map((rule, index) => ({
            id: `${input.id}:${rule.ruleId}:${index + 1}`,
            projectId: input.projectId,
            candidateId: input.id,
            evidenceLevel: rule.evidenceLevel,
            outcome: rule.outcome,
            ruleId: rule.ruleId,
            ruleVersion: rule.ruleVersion,
            explanation: rule.explanation,
            sourceRefs: rule.sourceRefs,
            ...(rule.scoreDelta !== undefined ? { scoreDelta: rule.scoreDelta } : {}),
          })),
        );
        await this.database.candidateDecisions.add({
          candidateId: input.id,
          projectId: input.projectId,
          stage: "inbox",
          updatedAt: input.createdAt,
        });
      },
    );
  }
}
