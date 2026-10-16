import type { ApplicationDatabase } from "../application/ports/database";
import { CreateNamingProject } from "../application/use-cases/CreateNamingProject";
import { DeleteNamingProject } from "../application/use-cases/DeleteNamingProject";
import { RenameNamingProject } from "../application/use-cases/RenameNamingProject";
import { CopyNamingConfiguration } from "../application/use-cases/CopyNamingConfiguration";
import { GetProjectWorkspace } from "../application/use-cases/GetProjectWorkspace";
import { GetCandidateFunnel } from "../application/use-cases/GetCandidateFunnel";
import { GetCandidateDetail } from "../application/use-cases/GetCandidateDetail";
import { GenerateCandidateBatch } from "../application/use-cases/GenerateCandidateBatch";
import { MoveCandidateDecision } from "../application/use-cases/MoveCandidateDecision";
import { ExcludeCandidate } from "../application/use-cases/ExcludeCandidate";
import { RestoreExcludedCandidate } from "../application/use-cases/RestoreExcludedCandidate";
import { ClearExcludedCandidates } from "../application/use-cases/ClearExcludedCandidates";
import { RecordCandidateEvaluation } from "../application/use-cases/RecordCandidateEvaluation";
import { ListProjectSummaries } from "../application/use-cases/ListProjectSummaries";
import { ExportProjectBackup } from "../application/use-cases/ExportProjectBackup";
import { ImportProjectBackup } from "../application/use-cases/ImportProjectBackup";
import { PreviewBackupImport } from "../application/use-cases/PreviewBackupImport";
import { PrepareAppUpdate } from "../application/use-cases/PrepareAppUpdate";
import { UndoCandidateDecision } from "../application/use-cases/UndoCandidateDecision";
import { AddManualCandidate } from "../application/use-cases/AddManualCandidate";
import type { AssessNamingProject } from "../application/use-cases/AssessNamingProject";
import type { AnalyzeCurrentProjectCandidates } from "../application/use-cases/AnalyzeCurrentProjectCandidates";
import type { SaveNamingConfiguration } from "../application/use-cases/SaveNamingConfiguration";
import { GetAssessmentRun } from "../application/use-cases/GetAssessmentRun";
import { activeRuntimeBundle } from "../data/activeRuntimeBundle";
import { UpdateNamingProfile } from "../application/use-cases/UpdateNamingProfile";
import type { EryaDatabase } from "./database/EryaDatabase";
import { DexieProjectRepository } from "./repositories/DexieProjectRepository";
import { DexieDecisionRepository } from "./repositories/DexieDecisionRepository";
import { DexieGenerationRepository } from "./repositories/DexieGenerationRepository";
import { DexieEvaluationRepository } from "./repositories/DexieEvaluationRepository";
import { DexieAssessmentRepository } from "./repositories/DexieAssessmentRepository";
import { DexieBackupRepository } from "./repositories/DexieBackupRepository";
import { RULE_PACK_VERSION } from "../domain/rules/rulePack";
import { DexieDurableWriter } from "./persistence/DexieDurableWriter";
import { LocalDraftWriter } from "./persistence/LocalDraftWriter";
import { DexieManualCandidateRepository } from "./repositories/DexieManualCandidateRepository";
import { SessionUndoStack } from "../domain/candidate/sessionUndo";
import { GetProjectJourneyView } from "../application/use-cases/GetProjectJourneyView";

export interface ApplicationContainer {
  readonly database: ApplicationDatabase;
  readonly createNamingProject?: CreateNamingProject;
  readonly deleteNamingProject?: DeleteNamingProject;
  readonly renameNamingProject?: RenameNamingProject;
  readonly copyNamingConfiguration?: CopyNamingConfiguration;
  readonly getProjectWorkspace?: GetProjectWorkspace;
  readonly updateNamingProfile?: UpdateNamingProfile;
  readonly generateCandidateBatch?: GenerateCandidateBatch;
  readonly getCandidateFunnel?: GetCandidateFunnel;
  readonly getCandidateDetail?: GetCandidateDetail;
  readonly moveCandidateDecision?: MoveCandidateDecision;
  readonly excludeCandidate?: ExcludeCandidate;
  readonly restoreExcludedCandidate?: RestoreExcludedCandidate;
  readonly clearExcludedCandidates?: ClearExcludedCandidates;
  readonly recordCandidateEvaluation?: RecordCandidateEvaluation;
  readonly listProjectSummaries?: ListProjectSummaries;
  readonly exportProjectBackup?: ExportProjectBackup;
  readonly previewBackupImport?: PreviewBackupImport;
  readonly importProjectBackup?: ImportProjectBackup;
  readonly prepareAppUpdate?: PrepareAppUpdate;
  readonly undoCandidateDecision?: UndoCandidateDecision;
  readonly addManualCandidate?: AddManualCandidate;
  readonly assessNamingProject?: Pick<AssessNamingProject, "execute">;
  readonly analyzeCurrentProjectCandidates?: Pick<AnalyzeCurrentProjectCandidates, "execute">;
  readonly saveNamingConfiguration?: Pick<SaveNamingConfiguration, "execute" | "preview">;
  readonly getAssessmentRun?: GetAssessmentRun;
  readonly getProjectJourneyView?: GetProjectJourneyView;
}

export function createApplicationContainer(dependencies: {
  database: ApplicationDatabase;
  createId?: () => string;
  now?: () => string;
}): ApplicationContainer {
  if (!("projects" in dependencies.database)) {
    return { database: dependencies.database };
  }

  const database = dependencies.database as EryaDatabase;
  const repository = new DexieProjectRepository(database);
  const generationRepository = new DexieGenerationRepository(database);
  const decisionRepository = new DexieDecisionRepository(database);
  const evaluationRepository = new DexieEvaluationRepository(database);
  const assessmentRepository = new DexieAssessmentRepository(database);
  const backupRepository = new DexieBackupRepository(database);
  const manualCandidateRepository = new DexieManualCandidateRepository(database);
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date().toISOString());
  const undoStack = new SessionUndoStack();
  const getCandidateFunnel = new GetCandidateFunnel(
    generationRepository,
    assessmentRepository,
    evaluationRepository,
    repository,
  );
  let assessmentServicesPromise: ReturnType<typeof loadAssessmentServices> | undefined;
  const assessmentServices = () =>
    (assessmentServicesPromise ??= loadAssessmentServices({
      repository,
      generationRepository,
      assessmentRepository,
      createId,
      now,
    }));
  return {
    database,
    createNamingProject: new CreateNamingProject(repository, { createId, now }),
    deleteNamingProject: new DeleteNamingProject(repository),
    renameNamingProject: new RenameNamingProject(repository, { now }),
    copyNamingConfiguration: new CopyNamingConfiguration(repository, { createId, now }),
    getProjectWorkspace: new GetProjectWorkspace(repository),
    updateNamingProfile: new UpdateNamingProfile(repository, generationRepository, {
      now,
      createRunId: createId,
    }),
    generateCandidateBatch: new GenerateCandidateBatch(repository, generationRepository, {
      loadBundle: () => activeRuntimeBundle,
      createBatchId: () => crypto.randomUUID(),
      createCandidateId: (fullName) => `${crypto.randomUUID()}:${fullName}`,
      now,
      analyzeCurrentRevision: async (input) =>
        (await assessmentServices()).analyzeCurrentProjectCandidates.execute(input),
    }),
    getCandidateFunnel,
    getCandidateDetail: new GetCandidateDetail(
      getCandidateFunnel,
      assessmentRepository,
      repository,
    ),
    moveCandidateDecision: new MoveCandidateDecision(decisionRepository, {
      now,
      undoStack,
    }),
    excludeCandidate: new ExcludeCandidate(decisionRepository, { now }),
    restoreExcludedCandidate: new RestoreExcludedCandidate(decisionRepository, { now }),
    clearExcludedCandidates: new ClearExcludedCandidates(decisionRepository),
    recordCandidateEvaluation: new RecordCandidateEvaluation(evaluationRepository, { now }),
    listProjectSummaries: new ListProjectSummaries(repository, generationRepository),
    exportProjectBackup: new ExportProjectBackup(backupRepository, {
      appVersion: __APP_VERSION__,
      datasetVersion: activeRuntimeBundle.manifest.version,
      rulePackVersion: RULE_PACK_VERSION,
      now,
    }),
    previewBackupImport: new PreviewBackupImport(backupRepository),
    importProjectBackup: new ImportProjectBackup(backupRepository, {
      createProjectId: createId,
    }),
    prepareAppUpdate: new PrepareAppUpdate([
      new LocalDraftWriter(),
      new DexieDurableWriter(database),
    ]),
    undoCandidateDecision: new UndoCandidateDecision(decisionRepository, {
      now,
      undoStack,
    }),
    addManualCandidate: new AddManualCandidate(repository, manualCandidateRepository, {
      loadBundle: () => activeRuntimeBundle,
      createId,
      now,
    }),
    assessNamingProject: {
      execute: async (input) => (await assessmentServices()).assessNamingProject.execute(input),
    },
    analyzeCurrentProjectCandidates: {
      execute: async (input) =>
        (await assessmentServices()).analyzeCurrentProjectCandidates.execute(input),
    },
    saveNamingConfiguration: {
      preview: async (input) =>
        (await assessmentServices()).saveNamingConfiguration.preview(input),
      execute: async (input) =>
        (await assessmentServices()).saveNamingConfiguration.execute(input),
    },
    getAssessmentRun: new GetAssessmentRun(assessmentRepository),
    getProjectJourneyView: new GetProjectJourneyView(repository, generationRepository),
  };
}

async function loadAssessmentServices(dependencies: {
  repository: DexieProjectRepository;
  generationRepository: DexieGenerationRepository;
  assessmentRepository: DexieAssessmentRepository;
  createId: () => string;
  now: () => string;
}) {
  const { createAssessmentServices } = await import("./createAssessmentServices");
  return createAssessmentServices({
    projectRepository: dependencies.repository,
    generationRepository: dependencies.generationRepository,
    assessmentRepository: dependencies.assessmentRepository,
    createId: dependencies.createId,
    now: dependencies.now,
  });
}
