import { EryaDatabase, ERYA_DATABASE_NAME } from "./EryaDatabase";

export class DatabaseOpenError extends Error {
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super("Unable to open the local Erya Names database");
    this.name = "DatabaseOpenError";
    this.cause = cause;
  }
}

export async function openDatabase(options: { name?: string } = {}): Promise<EryaDatabase> {
  const database = new EryaDatabase(options.name ?? ERYA_DATABASE_NAME);
  try {
    await database.open();
    return database;
  } catch (error) {
    database.close();
    throw new DatabaseOpenError(error);
  }
}
