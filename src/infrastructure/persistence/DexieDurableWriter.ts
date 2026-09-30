import type { DurableWriter } from "../../application/ports/DurableWriter";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieDurableWriter implements DurableWriter {
  constructor(private readonly database: EryaDatabase) {}

  async flush(): Promise<void> {
    await this.database.transaction("r", this.database.tables, async () => undefined);
  }
}
