import { EryaDatabase, ERYA_DATABASE_NAME } from "./EryaDatabase";

export class DatabaseOpenError extends Error {
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super("Unable to open the local Erya Names database");
    this.name = "DatabaseOpenError";
    this.cause = cause;
  }
}

export async function openDatabase(): Promise<EryaDatabase> {
  // The application has one writable namespace. Tests that need an isolated name construct
  // EryaDatabase directly; production code cannot accidentally reopen the legacy database.
  const database = new EryaDatabase(ERYA_DATABASE_NAME);
  try {
    await database.open();
    return database;
  } catch (error) {
    database.close();
    throw new DatabaseOpenError(error);
  }
}
