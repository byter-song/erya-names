import { describe, expect, it } from "vitest";
import { verifyArtifact } from "../../../scripts/release/verify-artifact";

describe("release artifact verification", () => {
  it("detects missing, changed and unexpected files", async () => {
    const manifest = {
      sha256: "a".repeat(64),
      entries: [{ path: "index.html", bytes: 5, sha256: "a".repeat(64) }],
    };
    expect(verifyArtifact(manifest, [])).toEqual({
      ok: false,
      errors: ["missing:index.html", "artifact-hash-mismatch"],
    });
  });

  it("rejects a forged top-level hash when every file entry matches", () => {
    const entries = [{ path: "index.html", bytes: 5, sha256: "b".repeat(64) }];
    expect(verifyArtifact({ sha256: "a".repeat(64), entries }, entries)).toEqual({
      ok: false,
      errors: ["artifact-hash-mismatch"],
    });
  });
});
