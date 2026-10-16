import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  SelectedNamesExport,
  SelectedNamesExportMode,
} from "../../../../src/application/models/SelectedNamesExport";
import { selectedNamesExportVisibility } from "../../../../src/application/models/SelectedNamesExport";
import { SelectedExportPage } from "../../../../src/features/export/SelectedExportPage";

describe("SelectedExportPage", () => {
  it("defaults to every selected name and requires an explicit personal-data confirmation", async () => {
    const user = userEvent.setup();
    const build = vi.fn(async (input: { mode: SelectedNamesExportMode }) => ({
      ok: true as const,
      value: documentFixture(input.mode),
    }));
    const exporter = {
      preview: vi.fn(
        async (input: { mode: SelectedNamesExportMode; candidateIds?: string[] }) => {
          const ids = input.candidateIds ?? ["c1", "c2"];
          return {
            ok: true as const,
            value: {
              mode: input.mode,
              availableCount: 2,
              selectedCount: ids.length,
              candidateIds: ids,
              candidateNames: ids.map((id) => (id === "c1" ? "宋清扬" : "宋知远")),
              hardRiskCount: 1,
              visibility: selectedNamesExportVisibility[input.mode],
              requiresPersonalConfirmation: input.mode === "personal",
            },
          };
        },
      ),
      build,
    };

    render(
      <SelectedExportPage
        exporter={exporter}
        onDownloadJson={vi.fn()}
        onPrint={vi.fn()}
        projectId="p1"
      />,
    );

    expect(await screen.findByText("共 2 个精选")).toBeVisible();
    expect(screen.getAllByRole("checkbox", { name: /宋清扬|宋知远/ })).toHaveLength(2);
    await user.click(screen.getByRole("radio", { name: /完整个人版/ }));
    await user.click(screen.getByRole("button", { name: "下载 JSON" }));
    expect(build).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("请先勾选确认");

    await user.click(screen.getByRole("checkbox", { name: /我确认此文件/ }));
    await user.click(screen.getByRole("button", { name: "下载 JSON" }));
    await waitFor(() =>
      expect(build).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateIds: ["c1", "c2"],
          mode: "personal",
          personalDataConfirmed: true,
        }),
      ),
    );
  });
});

function documentFixture(mode: SelectedNamesExportMode): SelectedNamesExport {
  return {
    schema: "erya-selected-names-export",
    schemaVersion: 1,
    mode,
    format: "json",
    generatedAt: "2026-10-16T10:00:00.000Z",
    project: { id: "p1", title: "宋姓方案", surname: "宋", configRevision: 0 },
    visibility: selectedNamesExportVisibility[mode],
    disclaimer: "按方案所选传统体系与流派计算；结论会随口径和资料完整度变化。",
    candidates: [],
  };
}
