import type { DurableWriter } from "../ports/DurableWriter";
import { err, ok, type Result } from "../../domain/shared/result";

export class PrepareAppUpdate {
  constructor(private readonly writers: DurableWriter[]) {}

  async execute(): Promise<Result<void, string>> {
    try {
      await Promise.all(this.writers.map((writer) => writer.flush()));
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error.message : "durable-flush-failed");
    }
  }
}
