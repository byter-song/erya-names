import { currentEligibility } from "../../domain/rules/currentEligibility";
import type { ReportRepository } from "../ports/ReportRepository";
import { err, ok, type Result } from "../../domain/shared/result";
import type { FinalReportModel } from "../models/FinalReportModel";

export class BuildFinalReport {
  constructor(private readonly repository: ReportRepository) {}

  async execute(projectId: string): Promise<Result<FinalReportModel, string>> {
    const report = await this.repository.buildFinalReport(projectId);
    if (!report) return err("final-report-not-ready");
    if (report.finalists.length < 1 || report.finalists.length > 5) {
      return err("final-report-requires-one-to-five-finalists");
    }
    if (report.profile)
      for (const candidate of report.finalists) {
        const issue = currentEligibility(
          {
            fullName: candidate.fullName,
            pinyin: candidate.pinyin,
            givenName:
              candidate.givenName ?? candidate.fullName.slice(report.profile.surname.length),
          },
          report.profile,
        );
        if (issue) return err(`${candidate.fullName}：${issue}`);
      }
    return ok(report);
  }
}
