export const traditionalPrinciples = ["信", "义", "象", "假", "类"] as const;

export type TraditionalPrinciple = (typeof traditionalPrinciples)[number];

export interface TraditionalTabooRule {
  id: string;
  terms: string[];
  label: string;
  sourceId: string;
}

export interface TraditionalNamingResult {
  principleTags: TraditionalPrinciple[];
  hits: Array<TraditionalTabooRule & { matchedTerms: string[] }>;
  deduction: number;
  hardStatus: "pass" | "notice";
}

/**
 * Applies the product's literal-reading rules for the five interpretation
 * principles and six historical taboo categories. A hit is a cultural note,
 * never a hard rejection; family-generation rules live in the family module.
 */
export function evaluateTraditionalNaming(input: {
  fullName: string;
  principleTags: readonly TraditionalPrinciple[];
  tabooRules: readonly TraditionalTabooRule[];
}): TraditionalNamingResult {
  const principleTags = traditionalPrinciples.filter((tag) =>
    input.principleTags.includes(tag),
  );
  const hits = input.tabooRules.flatMap((rule) => {
    const matchedTerms = [
      ...new Set(rule.terms.filter((term) => input.fullName.includes(term))),
    ];
    return matchedTerms.length ? [{ ...rule, matchedTerms }] : [];
  });

  return {
    principleTags,
    hits,
    deduction: Math.min(15, hits.length * 5),
    hardStatus: hits.length ? "notice" : "pass",
  };
}
