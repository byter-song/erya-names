import type { ReportRepository } from "../ports/ReportRepository";
import { err, ok, type Result } from "../../domain/shared/result";
import type { FinalReportModel } from "../models/FinalReportModel";

export class BuildFinalReport {
  constructor(private readonly repository: ReportRepository) {}

  async execute(projectId: string): Promise<Result<FinalReportModel, string>> {
    const report = await this.repository.buildFinalReport(projectId);
    if (!report) return err("final-report-not-ready");
    if (report.finalists.length < 3 || report.finalists.length > 5) {
      return err("final-report-requires-three-to-five-finalists");
    }
    return ok(report);
  }
}
