export const V1_STORES = {
  projects: "id, updatedAt, status",
  profiles: "projectId",
  generationBatches: "id, projectId, [projectId+sequence], createdAt",
  candidates: "id, projectId, batchId, [projectId+normalizedFingerprint], createdAt",
  candidateSources: "id, candidateId, sourceId",
  ruleResults: "id, candidateId, evidenceLevel, outcome",
  candidateDecisions: "candidateId, projectId, [projectId+stage], updatedAt",
  decisionHistory: "++id, projectId, candidateId, changedAt",
  candidateEvaluations: "candidateId, projectId, updatedAt",
  comparisonSnapshots: "id, projectId, createdAt",
  finalDecisions: "projectId, selectedCandidateId, updatedAt",
  appMetadata: "key",
} as const;
