import {
  isSelectedNamesExport,
  selectedNamesExportVisibility,
  type SelectedNamesExport,
} from "../../application/models/SelectedNamesExport";

/** Defense-in-depth for every output adapter. Share output never trusts caller-supplied flags. */
export function enforceSelectedNamesExportVisibility(
  value: SelectedNamesExport,
): SelectedNamesExport {
  if (value.mode === "personal")
    return { ...value, visibility: selectedNamesExportVisibility.personal };

  const shareValue = { ...value };
  delete shareValue.privateData;
  return {
    ...shareValue,
    visibility: selectedNamesExportVisibility.share,
    candidates: value.candidates.map((candidate) => ({
      ...candidate,
      hardRisks: candidate.hardRisks.map((risk) => {
        if (risk.ruleId.includes("family"))
          return {
            ...risk,
            explanation: "命中家庭硬性约束（亲属与避讳细节已隐藏）。",
          };
        if (risk.moduleId === "bazi_wuxing")
          return {
            ...risk,
            explanation: "命中八字五行硬性风险（出生与四柱细节已隐藏）。",
          };
        if (risk.moduleId === "zodiac")
          return { ...risk, explanation: "命中生肖硬性风险（生肖明细已隐藏）。" };
        return risk;
      }),
      evidence: candidate.evidence
        .filter(
          ({ moduleId, severity, status }) =>
            !["bazi_wuxing", "zodiac"].includes(moduleId) ||
            (severity === "hard" && status === "conflict"),
        )
        .map((evidence) => ({
          ...evidence,
          ...(evidence.ruleId.includes("family")
            ? { explanation: "家庭约束已核对，亲属与避讳细节已隐藏。" }
            : {}),
          inputSummary: "导出输入摘要已隐藏",
          calculation: [],
        })),
      ...(candidate.evaluation?.rating !== undefined
        ? {
            evaluation: {
              rating: candidate.evaluation.rating,
            },
          }
        : {}),
    })),
  };
}

export function enforceExportVisibility(value: unknown): unknown {
  return isSelectedNamesExport(value) ? enforceSelectedNamesExportVisibility(value) : value;
}
