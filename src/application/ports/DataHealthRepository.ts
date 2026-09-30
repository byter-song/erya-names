export interface LocalDataInspection {
  databaseVersion: number;
  tableNames: string[];
  metadataValid: boolean;
  counts: Record<string, number>;
}

export interface DataHealthRepository {
  inspect(): Promise<LocalDataInspection>;
}
