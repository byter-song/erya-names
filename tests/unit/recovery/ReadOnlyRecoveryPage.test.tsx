import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadOnlyRecoveryPage } from "../../../src/features/recovery/ReadOnlyRecoveryPage";

describe("ReadOnlyRecoveryPage", () => {
  it("offers only non-mutating exports", () => {
    render(
      <ReadOnlyRecoveryPage
        health={{
          healthy: false,
          readOnly: true,
          errors: ["schema-incompatible"],
          databaseVersion: 2,
          counts: { projects: 1 },
        }}
        onExportRawBackup={vi.fn()}
        onExportDiagnostic={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "导出原始本地数据" })).toBeVisible();
    expect(screen.getByRole("button", { name: "导出脱敏诊断" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /清空|修复|覆盖/ })).not.toBeInTheDocument();
  });
});
