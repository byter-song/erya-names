export type FiveElement = "wood" | "fire" | "earth" | "metal" | "water";

export interface CharacterElementRecord {
  char: string;
  element: FiveElement;
  reason: string;
  methodVersion: "semantic-imagery-1";
  reviewStatus: "source_checked";
  checkedAt: string;
  sourceRefs: string[];
}

export interface CharacterElementSource {
  schemaVersion: number;
  manifest?: {
    counts?: Record<string, number>;
  };
  records: CharacterElementRecord[];
}

export interface CharacterRow {
  char: string;
  meaning: string;
  element: string | undefined;
  line: number;
}

export const CHARACTER_ELEMENT_METHOD_VERSION: "semantic-imagery-1";
export const CHARACTER_ELEMENT_REVIEW_STATUS: "source_checked";
export const FIVE_ELEMENTS: readonly FiveElement[];

export function parseCharacterRows(tsv: string): CharacterRow[];

export function validateCharacterElementSource(options: {
  source: CharacterElementSource;
  characterRows: CharacterRow[];
  toSimplified?: (value: string) => string;
}): string[];

export function buildCharacterElementIndex(options: {
  source: CharacterElementSource;
  characterRows: CharacterRow[];
  toSimplified?: (value: string) => string;
}): Map<string, CharacterElementRecord>;
