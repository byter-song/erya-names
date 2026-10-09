export interface ProjectSummary {
  id: string;
  title: string;
  surname: string;
  stage: "onboarding" | "generation" | "funnel" | "comparison" | "finalization";
  status: "draft" | "active" | "archived" | "completed";
  candidateCount: number;
  favoriteCount: number;
  finalistCount: number;
  updatedAt: string;
}

export type ResumableProject = Pick<ProjectSummary, "id" | "stage" | "status">;
