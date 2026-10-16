import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { analyzeUsefulGod } from "../../../../src/domain/folklore/usefulGod";
import { SaveImpactPanel } from "../../../../src/features/configuration/SaveImpactPanel";
import { UsefulGodDecisionPanel } from "../../../../src/features/configuration/UsefulGodDecisionPanel";

describe("configuration decision and save feedback", () => {
  it("presents the research evidence before allowing a user-confirmed useful-god choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const analysis = analyzeUsefulGod({
      pillars: ["甲子", "丙寅", "戊辰", "庚午"],
      dayMasterElement: "earth",
      distribution: { wood: 2, fire: 2, earth: 2, metal: 1, water: 1 },
      monthBranch: "寅",
    });

    render(
      <UsefulGodDecisionPanel
        analysis={analysis}
        now={() => "2026-10-16T08:00:00.000Z"}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/采用项需由你确认/)).toBeVisible();
    expect(screen.getAllByText(/产品公式已审计 · 研究模型/).length).toBeGreaterThan(0);
    expect(screen.getByText(/尚未确认/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "采用当前建议" }));
    expect(onChange).toHaveBeenCalledWith({
      confirmedElements: analysis.consensus.candidateElements,
      confirmedAt: "2026-10-16T08:00:00.000Z",
    });

    await user.click(screen.getByRole("checkbox", { name: "木" }));
    expect(onChange).toHaveBeenCalledWith({
      confirmedElements: ["wood"],
      confirmedAt: "2026-10-16T08:00:00.000Z",
    });
  });

  it("announces recalculation impact and progress without relying on color", () => {
    render(
      <SaveImpactPanel
        impact={{
          changedSections: ["calendar", "bazi_wuxing"],
          recalculationRequired: true,
          affectedCandidateCount: 24,
          missingInputs: [],
        }}
        onSave={vi.fn()}
        run={{
          projectId: "project-1",
          runId: "run-1",
          configRevision: 2,
          status: "running",
          completed: 12,
          total: 24,
        }}
      />,
    );

    expect(screen.getByText("将重新分析 24 个名字。")).toBeVisible();
    expect(screen.getByText("重算进度 12/24（50%）")).toBeVisible();
    expect(screen.getByText("分析进行中")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "12");
  });
});
