import type { RuntimeBundle } from "../../data/schema/runtimeBundle";
import type { GeneratedCandidate } from "../generation/generateCandidates";
import type { NamingProfile } from "../project/profile";
import { evaluateFamilyConstraints } from "./l1/familyConstraint";
import { evaluateStandardCharacters } from "./l1/standardCharacter";
import { evaluateReviewedRisks } from "./l2/reviewedRisks";
import type { RuleEvaluation } from "./types";

export const RULE_PACK_VERSION = "core-rules-3";

export function evaluateCandidateRules(input: {
  candidate: Pick<GeneratedCandidate, "fullName" | "givenName" | "riskSignals">;
  profile: NamingProfile;
  bundle: RuntimeBundle;
}): RuleEvaluation {
  const results = [
    evaluateStandardCharacters(
      input.candidate.fullName,
      input.candidate.givenName,
      input.bundle,
    ),
    evaluateFamilyConstraints({
      fullName: input.candidate.fullName,
      givenName: input.candidate.givenName,
      profile: input.profile,
    }),
    ...evaluateReviewedRisks({
      givenName: input.candidate.givenName,
      sourceRiskSignals: input.candidate.riskSignals,
      bundle: input.bundle,
    }),
  ];

  return {
    accepted: !results.some((result) => result.outcome === "reject"),
    results,
  };
}
