import type { ManualCandidateRepository } from "../ports/ManualCandidateRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import type { RuntimeBundle } from "../../data/schema/runtimeBundle";
import standardCharacters from "../../data/curated/standard-characters.json";
import { evaluateFamilyConstraints } from "../../domain/rules/l1/familyConstraint";
import { evaluateReviewedRisks } from "../../domain/rules/l2/reviewedRisks";
import { err, ok, type Result } from "../../domain/shared/result";

export class AddManualCandidate {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly candidates: ManualCandidateRepository,
    private readonly dependencies: {
      loadBundle: () => RuntimeBundle;
      createId: () => string;
      now: () => string;
    },
  ) {}

  async execute(input: {
    projectId: string;
    fullName: string;
    userSource: string;
    meaning: string;
  }): Promise<Result<{ candidateId: string }, string>> {
    if (!input.userSource.trim()) return err("manual-source-required");
    if (!input.meaning.trim()) return err("manual-meaning-required");
    const workspace = await this.projects.getWorkspace(input.projectId);
    if (!workspace) return err("project-not-found");
    const fullName = input.fullName.trim().normalize("NFC");
    if (!fullName.startsWith(workspace.profile.surname)) return err("surname-mismatch");
    const givenName = fullName.slice(workspace.profile.surname.length);
    const family = evaluateFamilyConstraints({
      fullName,
      givenName,
      profile: workspace.profile,
    });
    if (family.outcome === "reject") return err(family.explanation);
    const official = new Set(standardCharacters.characters);
    const unsupported = [...fullName].filter((char) => !official.has(char));
    if (unsupported.length) return err(`不在《通用规范汉字表》中：${unsupported.join("、")}`);
    if (await this.candidates.exists(input.projectId, fullName))
      return err("这个名字已经在本方案中，请在灵感池或候选集中搜索后保留。");

    const bundle = this.dependencies.loadBundle();
    const bundleCharacters = new Map(bundle.characters.map((entry) => [entry.char, entry]));
    const missingEvidence = [...givenName].filter((char) => !bundleCharacters.has(char));
    const reviewedRisks = evaluateReviewedRisks({
      givenName,
      sourceRiskSignals: [],
      bundle,
    });
    const rejectedRisk = reviewedRisks.find((rule) => rule.outcome === "reject");
    if (rejectedRisk) return err(rejectedRisk.explanation);
    const candidateId = this.dependencies.createId();
    await this.candidates.save({
      id: candidateId,
      projectId: input.projectId,
      fullName,
      surname: workspace.profile.surname,
      givenName,
      normalizedFingerprint: fullName,
      summary: input.meaning.trim(),
      userSource: input.userSource.trim(),
      pinyin: [...givenName].flatMap((char) => bundleCharacters.get(char)?.pinyin[0] ?? []),
      riskSignals: [...givenName].flatMap(
        (char) => bundleCharacters.get(char)?.riskSignals ?? [],
      ),
      characterEvidence: [...givenName].map((char) => {
        const entry = bundleCharacters.get(char);
        return {
          char,
          pinyin: entry?.pinyin ?? [],
          meanings: entry?.meanings ?? [],
          sourceRefs: entry?.sourceRefs.map((source) => source.sourceId) ?? [],
        };
      }),
      createdAt: this.dependencies.now(),
      ruleResults: [
        {
          evidenceLevel: "L1",
          outcome: "pass",
          ruleId: "l1-standard-character",
          ruleVersion: "l1-standard-character-1",
          explanation: "完整姓名均在《通用规范汉字表》中",
          sourceRefs: ["standard-hanzi-2013"],
          scoreDelta: 0,
        },
        family,
        ...reviewedRisks,
        ...(missingEvidence.length
          ? [
              {
                evidenceLevel: "L2" as const,
                outcome: "unknown" as const,
                ruleId: "l2-manual-unreviewed-character",
                ruleVersion: "manual-candidate-1",
                explanation: `用户录入字缺少精选字卡证据：${missingEvidence.join("、")}；读音、字义和谐音需人工确认`,
                sourceRefs: [],
                scoreDelta: 0,
              },
            ]
          : []),
      ],
    });
    return ok({ candidateId });
  }
}
