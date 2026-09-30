import { describe, expect, it, vi } from "vitest";
import { checkForUpdate } from "../../../src/infrastructure/versioning/checkForUpdate";

describe("checkForUpdate", () => {
  it("fetches a no-store manifest and reports a compatible newer release", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          appVersion: "0.2.1",
          buildHash: "build-021",
          minimumDatabaseVersion: 1,
          maximumDatabaseVersion: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      checkForUpdate({ currentVersion: "0.2.0", databaseVersion: 1, fetcher }),
    ).resolves.toMatchObject({ available: true, compatible: true, latestVersion: "0.2.1" });
    expect(fetcher).toHaveBeenCalledWith("/version.json", { cache: "no-store" });
  });
});
