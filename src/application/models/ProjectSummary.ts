import type { CandidatePool } from "../../domain/candidate/decision";

export interface ProjectSummary {
  id: string;
  title: string;
  surname: string;
  stage: "configuration" | "naming" | "export";
  status: "draft" | "active" | "completed";
  poolCounts: Record<CandidatePool, number>;
  totalCandidateCount: number;
  updatedAt: string;
}

export type ResumableProject = Pick<ProjectSummary, "id" | "stage" | "status">;
