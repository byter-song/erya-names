import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateFunnelItem } from "../../src/application/models/CandidateFunnelItem";
import type { SelectedNamesExport } from "../../src/application/models/SelectedNamesExport";
import { SelectedExportDocumentView } from "../../src/features/export/SelectedExportPage";
import { InkLongScrollPage } from "../../src/features/scroll/InkLongScrollPage";
import { namingProfileFixture } from "../fixtures/namingProfile";

const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});

function candidateFixture(): CandidateFunnelItem {
  return {
    id: "xss",
    createdAt: "2026-10-16T00:00:00.000Z",
    fullName: payload,
    givenName: payload,
    pinyin: [],
    sourceType: "user_input",
    summary: payload,
    sourceEvidence: [],
    pool: "inspiration",
    decisionUpdatedAt: "2026-10-16T00:00:00.000Z",
    scoringPending: false,
    hardStatus: "pass",
    totalScore: 88,
    completeness: 1,
    moduleScores: { basic: 88 },
    topDeductions: [],
    hiddenScoredModuleCount: 0,
  };
}

describe("user content rendering", () => {
  it("renders long-scroll candidate text literally without executable markup", () => {
    const { container } = render(
      <InkLongScrollPage
        candidates={[candidateFixture()]}
        chapter="inspiration"
        generationBusy={false}
        onAddManual={vi.fn()}
        onChapterChange={vi.fn()}
        onEvaluate={vi.fn()}
        onExclude={vi.fn()}
        onGenerate={vi.fn()}
        onMove={vi.fn()}
        onOpenConfiguration={vi.fn()}
        onOpenExport={vi.fn()}
        onRestore={vi.fn()}
        onUndo={vi.fn()}
        profile={namingProfileFixture()}
      />,
    );

    expect(screen.getAllByText(payload).length).toBeGreaterThan(0);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("escapes user-authored text in the current selected-names export document", () => {
    const document: SelectedNamesExport = {
      schema: "erya-selected-names-export",
      schemaVersion: 1,
      mode: "personal",
      format: "print",
      generatedAt: "2026-10-16T00:00:00.000Z",
      project: { id: "p1", title: payload, surname: "宋", configRevision: 1 },
      visibility: {
        birthData: true,
        fourPillars: true,
        relatives: true,
        zodiacDetails: true,
        notes: true,
      },
      disclaimer: "按方案所选传统体系与流派计算；结论会随口径和资料完整度变化。",
      candidates: [
        {
          id: "c1",
          givenName: payload,
          fullName: payload,
          pinyin: [],
          summary: payload,
          sources: [],
          hardStatus: "pass",
          hardRisks: [],
          evidence: [],
          evaluation: { rating: 5, note: payload },
        },
      ],
      privateData: { relatives: { names: [], avoidances: [] }, notes: {} },
    };
    const { container } = render(<SelectedExportDocumentView document={document} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getAllByText(payload).length).toBeGreaterThan(0);
  });
});
