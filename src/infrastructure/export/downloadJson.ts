import type { SelectedNamesExport } from "../../application/models/SelectedNamesExport";
import {
  enforceExportVisibility,
  enforceSelectedNamesExportVisibility,
} from "./selectedNamesVisibility";

export function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(enforceExportVisibility(value), null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function prepareSelectedNamesJson(value: SelectedNamesExport): SelectedNamesExport {
  return enforceSelectedNamesExportVisibility(value);
}

export function downloadSelectedNamesJson(filename: string, value: SelectedNamesExport): void {
  downloadJson(filename, prepareSelectedNamesJson(value));
}
