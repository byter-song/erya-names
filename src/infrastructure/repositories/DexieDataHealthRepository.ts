import type { DataHealthRepository } from "../../application/ports/DataHealthRepository";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieDataHealthRepository implements DataHealthRepository {
  constructor(private readonly database: EryaDatabase) {}

  async inspect() {
    await this.database.open();
    const tableNames = this.database.tables.map((table) => table.name);
    const counts = Object.fromEntries(
      await Promise.all(
        this.database.tables.map(async (table) => [table.name, await table.count()] as const),
      ),
    );
    const metadata = await this.database.appMetadata.get("database-schema");
    return {
      databaseVersion: this.database.verno,
      tableNames,
      metadataValid:
        metadata === undefined ||
        (typeof metadata.value === "object" && metadata.value !== null),
      counts,
    };
  }
}
