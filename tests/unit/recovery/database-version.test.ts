import { describe, expect, it } from "vitest";
import { isFutureDexieDatabaseVersion } from "../../../src/infrastructure/database/versionCompatibility";

describe("Dexie database version compatibility", () => {
  it("interprets the native IndexedDB version using Dexie's tenfold encoding", () => {
    expect(isFutureDexieDatabaseVersion(30, 3)).toBe(false);
    expect(isFutureDexieDatabaseVersion(40, 3)).toBe(true);
  });
});
