export interface RawDatabaseSnapshot {
  format: "erya-names-raw-database";
  databaseName: string;
  databaseVersion: number;
  exportedAt: string;
  stores: Record<string, unknown[]>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function exportRawDatabase(databaseName: string): Promise<RawDatabaseSnapshot> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });

  try {
    const names = [...database.objectStoreNames];
    if (names.length === 0) {
      return {
        format: "erya-names-raw-database",
        databaseName,
        databaseVersion: database.version,
        exportedAt: new Date().toISOString(),
        stores: {},
      };
    }
    const transaction = database.transaction(names, "readonly");
    const stores = Object.fromEntries(
      await Promise.all(
        names.map(
          async (name) =>
            [name, await requestResult(transaction.objectStore(name).getAll())] as const,
        ),
      ),
    );
    return {
      format: "erya-names-raw-database",
      databaseName,
      databaseVersion: database.version,
      exportedAt: new Date().toISOString(),
      stores,
    };
  } finally {
    database.close();
  }
}
