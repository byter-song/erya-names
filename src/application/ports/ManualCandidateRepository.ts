import type { Candidate } from "../../domain/candidate/candidate";

export interface ManualCandidateInput {
  candidate: Candidate;
  source: {
    id: string;
    projectId: string;
    candidateId: string;
    sourceId: string;
    location: string;
  };
}

export interface ManualCandidateRepository {
  exists(projectId: string, normalizedFingerprint: string): Promise<boolean>;
  save(input: ManualCandidateInput): Promise<void>;
}
