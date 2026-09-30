import type { NamingProfile } from "../../domain/project/profile";
import type { CandidateWarningEvidence } from "./CandidateFunnelItem";

export interface FinalReportSource {
  sourceId: string;
  title?: string;
  work?: string;
  quote?: string;
  location?: string;
  excerpt?: string;
}

export interface FinalReportCandidate {
  givenName?: string;
  characterEvidence?: Array<{
    char: string;
    pinyin: string[];
    meanings: string[];
    sourceRefs: string[];
  }>;
  id: string;
  fullName: string;
  pinyin: string[];
  summary: string;
  sources: FinalReportSource[];
  warnings: CandidateWarningEvidence[];
  rating?: number;
  note?: string;
}

export interface FinalReportModel {
  profile?: NamingProfile;
  projectTitle: string;
  selectedCandidateId: string;
  rationale: string;
  privateData: { birthLocalDateTime?: string; avoidCharacters: string[] };
  folkloreEnabled: boolean;
  finalists: FinalReportCandidate[];
}
