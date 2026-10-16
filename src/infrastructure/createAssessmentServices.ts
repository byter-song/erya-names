import { createCandidateAssessmentEvaluator } from "../application/services/createCandidateAssessmentEvaluator";
import { AnalyzeCurrentProjectCandidates } from "../application/use-cases/AnalyzeCurrentProjectCandidates";
import { AssessNamingProject } from "../application/use-cases/AssessNamingProject";
import {
  RecalculateProjectAssessments,
  createAssessmentScheduler,
} from "../application/use-cases/RecalculateProjectAssessments";
import { SaveNamingConfiguration } from "../application/use-cases/SaveNamingConfiguration";
import { activeRuntimeBundle } from "../data/activeRuntimeBundle";
import type { DexieAssessmentRepository } from "./repositories/DexieAssessmentRepository";
import type { DexieGenerationRepository } from "./repositories/DexieGenerationRepository";
import type { DexieProjectRepository } from "./repositories/DexieProjectRepository";

/** Build calendar and scoring services only when configuration or generation requests analysis. */
export function createAssessmentServices(dependencies: {
  projectRepository: DexieProjectRepository;
  generationRepository: DexieGenerationRepository;
  assessmentRepository: DexieAssessmentRepository;
  createId: () => string;
  now: () => string;
}) {
  const assessNamingProject = new AssessNamingProject(
    dependencies.projectRepository,
    dependencies.assessmentRepository,
  );
  const recalculateProjectAssessments = new RecalculateProjectAssessments(
    dependencies.projectRepository,
    dependencies.generationRepository,
    dependencies.assessmentRepository,
    {
      batchSize: 50,
      scheduler: createAssessmentScheduler({
        setTimeout: (callback, delay) => window.setTimeout(callback, delay),
        ...("requestIdleCallback" in window
          ? {
              requestIdleCallback: (callback: () => void) =>
                window.requestIdleCallback(callback),
            }
          : {}),
      }),
      evaluateCandidate: createCandidateAssessmentEvaluator(activeRuntimeBundle),
    },
  );
  const analyzeCurrentProjectCandidates = new AnalyzeCurrentProjectCandidates(
    dependencies.projectRepository,
    dependencies.generationRepository,
    dependencies.assessmentRepository,
    assessNamingProject,
    recalculateProjectAssessments,
    { createRunId: dependencies.createId },
  );
  const saveNamingConfiguration = new SaveNamingConfiguration(
    dependencies.projectRepository,
    dependencies.generationRepository,
    {
      now: dependencies.now,
      createRunId: dependencies.createId,
      onRecalculationRequested: ({ projectId, runId }) => {
        void analyzeCurrentProjectCandidates.continueRun({ projectId, runId });
      },
    },
  );

  return { assessNamingProject, analyzeCurrentProjectCandidates, saveNamingConfiguration };
}
