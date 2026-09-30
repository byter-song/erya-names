import type { FinalReportModel } from "../models/FinalReportModel";

export interface ReportRepository {
  buildFinalReport(projectId: string): Promise<FinalReportModel | undefined>;
}
