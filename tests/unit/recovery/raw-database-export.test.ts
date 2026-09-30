import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { exportRawDatabase } from "../../../src/infrastructure/backup/exportRawDatabase";

const names = new Set<string>();
afterEach(async () => {
  await Promise.all([...names].map((name) => indexedDB.deleteDatabase(name)));
  names.clear();
});

describe("exportRawDatabase", () => {
  it("reads every object store without mutating it", async () => {
    const name = `erya-raw-${crypto.randomUUID()}`;
    names.add(name);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 2);
      request.onupgradeneeded = () =>
        request.result
          .createObjectStore("projects", { keyPath: "id" })
          .put({ id: "p1", title: "宋姓宝宝起名" });
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const snapshot = await exportRawDatabase(name);
    expect(snapshot).toMatchObject({
      databaseName: name,
      databaseVersion: 2,
      stores: { projects: [{ id: "p1" }] },
    });
    expect(await indexedDB.databases()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name, version: 2 })]),
    );
  });
});
