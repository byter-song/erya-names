import type { AssessmentRepository } from "../ports/AssessmentRepository";

export class GetAssessmentRun {
  constructor(private readonly assessments: AssessmentRepository) {}

  execute(projectId: string) {
    return this.assessments.getRun(projectId);
  }
}
