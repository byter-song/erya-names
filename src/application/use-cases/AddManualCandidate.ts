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
    const surname = workspace.profile.basics.surname;
    if (!fullName.startsWith(surname)) return err("surname-mismatch");
    const givenName = fullName.slice(surname.length);
    const bundle = this.dependencies.loadBundle();
    const bundleCharacters = new Map(bundle.characters.map((entry) => [entry.char, entry]));
    const pinyinIndex = bundle.standardCharacterPinyin;
    const pinyin = [...givenName].flatMap(
      (char) => bundleCharacters.get(char)?.pinyin[0] ?? pinyinIndex[char]?.[0] ?? [],
    );
    const family = evaluateFamilyConstraints({
      fullName,
      givenName,
      pinyin,
      profile: workspace.profile,
    });
    if (family.outcome === "reject") return err(family.explanation);
    const official = new Set(standardCharacters.characters);
    const unsupported = [...fullName].filter((char) => !official.has(char));
    if (unsupported.length) return err(`不在《通用规范汉字表》中：${unsupported.join("、")}`);
    if (await this.candidates.exists(input.projectId, fullName))
      return err("这个名字已经在本方案中，请在灵感池或候选集中搜索后保留。");

    const reviewedRisks = evaluateReviewedRisks({
      givenName,
      sourceRiskSignals: [],
      bundle,
    });
    const rejectedRisk = reviewedRisks.find((rule) => rule.outcome === "reject");
    if (rejectedRisk) return err(rejectedRisk.explanation);
    const candidateId = this.dependencies.createId();
    const createdAt = this.dependencies.now();
    await this.candidates.save({
      candidate: {
        id: candidateId,
        projectId: input.projectId,
        fullName,
        surname,
        givenName,
        normalizedFingerprint: fullName,
        summary: input.meaning.trim(),
        pinyin,
        sourceType: "user_input",
        batchId: null,
        createdAt,
      },
      source: {
        id: `${candidateId}:source:1`,
        projectId: input.projectId,
        candidateId,
        sourceId: "user-input",
        location: input.userSource.trim(),
      },
    });
    return ok({ candidateId });
  }
}
