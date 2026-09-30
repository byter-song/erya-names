import type { DataHealthRepository } from "../ports/DataHealthRepository";

export interface LocalDataHealth {
  healthy: boolean;
  readOnly: boolean;
  errors: string[];
  databaseVersion: number;
  counts: Record<string, number>;
}

export class CheckLocalDataHealth {
  constructor(
    private readonly repository: DataHealthRepository,
    private readonly contract: { supportedVersion: number; requiredTables: string[] },
  ) {}

  async execute(): Promise<LocalDataHealth> {
    const inspection = await this.repository.inspect();
    const errors: string[] = [];
    if (inspection.databaseVersion !== this.contract.supportedVersion)
      errors.push("schema-incompatible");
    for (const table of this.contract.requiredTables) {
      if (!inspection.tableNames.includes(table)) errors.push(`missing-table:${table}`);
    }
    if (!inspection.metadataValid) errors.push("invalid-metadata");
    return {
      healthy: errors.length === 0,
      readOnly: errors.length > 0,
      errors,
      databaseVersion: inspection.databaseVersion,
      counts: inspection.counts,
    };
  }
}
