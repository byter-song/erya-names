import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "../../../src/infrastructure/backup/encryption";

const fixedBytes = {
  salt: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
  iv: new Uint8Array([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]),
};

describe("encrypted backups", () => {
  it("uses PBKDF2-SHA-256 and AES-GCM with explicit parameters", async () => {
    const encrypted = await encryptBackup('{"projectId":"project-song"}', "safe password", {
      randomBytes: (length) =>
        length === fixedBytes.salt.length ? fixedBytes.salt : fixedBytes.iv,
      iterations: 120_000,
    });

    expect(encrypted).toMatchObject({
      format: "erya-names-encrypted-backup",
      schemaVersion: 1,
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 120_000 },
      cipher: { name: "AES-GCM" },
    });
    expect(encrypted).not.toHaveProperty("password");
    expect(encrypted).not.toHaveProperty("key");
    await expect(decryptBackup(encrypted, "safe password")).resolves.toBe(
      '{"projectId":"project-song"}',
    );
  });

  it("uses fresh salt and IV values for every export", async () => {
    const first = await encryptBackup("payload", "safe password");
    const second = await encryptBackup("payload", "safe password");

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects a wrong password and modified ciphertext before returning plaintext", async () => {
    const encrypted = await encryptBackup("payload", "safe password");

    await expect(decryptBackup(encrypted, "wrong password")).rejects.toThrow();
    const changed = {
      ...encrypted,
      ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA`,
    };
    await expect(decryptBackup(changed, "safe password")).rejects.toThrow();
  });
});
