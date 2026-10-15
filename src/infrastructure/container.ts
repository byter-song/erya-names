import type { ApplicationDatabase } from "../application/ports/database";
import { CreateNamingProject } from "../application/use-cases/CreateNamingProject";
import { DeleteNamingProject } from "../application/use-cases/DeleteNamingProject";
import { GetProjectWorkspace } from "../application/use-cases/GetProjectWorkspace";
import { GetCandidateFunnel } from "../application/use-cases/GetCandidateFunnel";
import { GetFinalDecision } from "../application/use-cases/GetFinalDecision";
import { GenerateCandidateBatch } from "../application/use-cases/GenerateCandidateBatch";
import { FinalizeNamingDecision } from "../application/use-cases/FinalizeNamingDecision";
import { MoveCandidateDecision } from "../application/use-cases/MoveCandidateDecision";
import { RecordCandidateEvaluation } from "../application/use-cases/RecordCandidateEvaluation";
import { ListProjectSummaries } from "../application/use-cases/ListProjectSummaries";
import { ExportProjectBackup } from "../application/use-cases/ExportProjectBackup";
import { ImportProjectBackup } from "../application/use-cases/ImportProjectBackup";
import { PreviewBackupImport } from "../application/use-cases/PreviewBackupImport";
import { BuildFinalReport } from "../application/use-cases/BuildFinalReport";
import { PrepareAppUpdate } from "../application/use-cases/PrepareAppUpdate";
import { UndoCandidateDecision } from "../application/use-cases/UndoCandidateDecision";
import { CreateComparisonSnapshot } from "../application/use-cases/CreateComparisonSnapshot";
import { AddManualCandidate } from "../application/use-cases/AddManualCandidate";
import { activeRuntimeBundle } from "../data/activeRuntimeBundle";
import { UpdateNamingProfile } from "../application/use-cases/UpdateNamingProfile";
import type { EryaDatabase } from "./database/EryaDatabase";
import { DexieProjectRepository } from "./repositories/DexieProjectRepository";
import { DexieDecisionRepository } from "./repositories/DexieDecisionRepository";
import { DexieGenerationRepository } from "./repositories/DexieGenerationRepository";
import { DexieEvaluationRepository } from "./repositories/DexieEvaluationRepository";
import { DexieFinalDecisionRepository } from "./repositories/DexieFinalDecisionRepository";
import { DexieBackupRepository } from "./repositories/DexieBackupRepository";
import { DexieReportRepository } from "./repositories/DexieReportRepository";
import { RULE_PACK_VERSION } from "../domain/rules/rulePack";
import { DexieDurableWriter } from "./persistence/DexieDurableWriter";
import { LocalDraftWriter } from "./persistence/LocalDraftWriter";
import { DexieComparisonRepository } from "./repositories/DexieComparisonRepository";
import { DexieManualCandidateRepository } from "./repositories/DexieManualCandidateRepository";
import { SessionUndoStack } from "../domain/candidate/sessionUndo";
import { familyRulesArePending } from "../domain/project/profile";
import { ApplyCandidateAutoFilter } from "../application/use-cases/ApplyCandidateAutoFilter";
import { GetProjectJourneyView } from "../application/use-cases/GetProjectJourneyView";
import { UpdateFolkloreReviewSettings } from "../application/use-cases/UpdateFolkloreReviewSettings";

export interface ApplicationContainer {
  readonly database: ApplicationDatabase;
  readonly createNamingProject?: CreateNamingProject;
  readonly deleteNamingProject?: DeleteNamingProject;
  readonly getProjectWorkspace?: GetProjectWorkspace;
  readonly updateNamingProfile?: UpdateNamingProfile;
  readonly generateCandidateBatch?: GenerateCandidateBatch;
  readonly getCandidateFunnel?: GetCandidateFunnel;
  readonly moveCandidateDecision?: MoveCandidateDecision;
  readonly recordCandidateEvaluation?: RecordCandidateEvaluation;
  readonly finalizeNamingDecision?: FinalizeNamingDecision;
  readonly listProjectSummaries?: ListProjectSummaries;
  readonly getFinalDecision?: GetFinalDecision;
  readonly exportProjectBackup?: ExportProjectBackup;
  readonly previewBackupImport?: PreviewBackupImport;
  readonly importProjectBackup?: ImportProjectBackup;
  readonly buildFinalReport?: BuildFinalReport;
  readonly prepareAppUpdate?: PrepareAppUpdate;
  readonly undoCandidateDecision?: UndoCandidateDecision;
  readonly createComparisonSnapshot?: CreateComparisonSnapshot;
  readonly addManualCandidate?: AddManualCandidate;
  readonly applyCandidateAutoFilter?: ApplyCandidateAutoFilter;
  readonly getProjectJourneyView?: GetProjectJourneyView;
  readonly updateFolkloreReviewSettings?: UpdateFolkloreReviewSettings;
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
  const finalDecisionRepository = new DexieFinalDecisionRepository(database);
  const backupRepository = new DexieBackupRepository(database);
  const reportRepository = new DexieReportRepository(database);
  const comparisonRepository = new DexieComparisonRepository(database);
  const manualCandidateRepository = new DexieManualCandidateRepository(database);
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date().toISOString());
  const undoStack = new SessionUndoStack();
  const canProgress = async (projectId: string) => {
    const workspace = await repository.getWorkspace(projectId);
    return Boolean(workspace && !familyRulesArePending(workspace.profile));
  };

  return {
    database,
    createNamingProject: new CreateNamingProject(repository, { createId, now }),
    deleteNamingProject: new DeleteNamingProject(repository),
    getProjectWorkspace: new GetProjectWorkspace(repository),
    updateNamingProfile: new UpdateNamingProfile(repository, { now }),
    generateCandidateBatch: new GenerateCandidateBatch(repository, generationRepository, {
      loadBundle: () => activeRuntimeBundle,
      createBatchId: () => crypto.randomUUID(),
      createCandidateId: (fullName) => `${crypto.randomUUID()}:${fullName}`,
      now,
    }),
    getCandidateFunnel: new GetCandidateFunnel(
      generationRepository,
      evaluationRepository,
      repository,
    ),
    moveCandidateDecision: new MoveCandidateDecision(decisionRepository, {
      now,
      canProgress,
      undoStack,
    }),
    recordCandidateEvaluation: new RecordCandidateEvaluation(evaluationRepository, { now }),
    finalizeNamingDecision: new FinalizeNamingDecision(finalDecisionRepository, { now }),
    listProjectSummaries: new ListProjectSummaries(repository, generationRepository),
    getFinalDecision: new GetFinalDecision(finalDecisionRepository),
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
    buildFinalReport: new BuildFinalReport(reportRepository),
    prepareAppUpdate: new PrepareAppUpdate([
      new LocalDraftWriter(),
      new DexieDurableWriter(database),
    ]),
    undoCandidateDecision: new UndoCandidateDecision(decisionRepository, {
      now,
      canProgress,
      undoStack,
    }),
    createComparisonSnapshot: new CreateComparisonSnapshot(comparisonRepository, {
      createId,
      now,
    }),
    addManualCandidate: new AddManualCandidate(repository, manualCandidateRepository, {
      loadBundle: () => activeRuntimeBundle,
      createId,
      now,
    }),
    applyCandidateAutoFilter: new ApplyCandidateAutoFilter(decisionRepository, {
      createBatchId: createId,
      now,
    }),
    getProjectJourneyView: new GetProjectJourneyView(repository, generationRepository),
    updateFolkloreReviewSettings: new UpdateFolkloreReviewSettings(
      repository,
      generationRepository,
      { now },
    ),
  };
}
