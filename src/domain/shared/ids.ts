export type ProjectId = string & { readonly __brand: "ProjectId" };
export type BatchId = string & { readonly __brand: "BatchId" };
export type CandidateId = string & { readonly __brand: "CandidateId" };

function requireIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty`);
  }
  return normalized;
}

export function createProjectId(value: string): ProjectId {
  return requireIdentifier(value, "ProjectId") as ProjectId;
}

export function createBatchId(value: string): BatchId {
  return requireIdentifier(value, "BatchId") as BatchId;
}

export function createCandidateId(value: string): CandidateId {
  return requireIdentifier(value, "CandidateId") as CandidateId;
}
