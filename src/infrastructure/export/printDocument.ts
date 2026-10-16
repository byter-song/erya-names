import type { SelectedNamesExport } from "../../application/models/SelectedNamesExport";
import { enforceSelectedNamesExportVisibility } from "./selectedNamesVisibility";

export function preparePrintDocument(value: SelectedNamesExport): SelectedNamesExport {
  return enforceSelectedNamesExportVisibility(value);
}

export function printDocument(): void {
  window.print();
}
