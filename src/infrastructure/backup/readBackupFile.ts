import { decryptBackup } from "./encryption";

export async function readBackupFile(file: File, password?: string): Promise<unknown> {
  const parsed: unknown = JSON.parse(await file.text());
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "format" in parsed &&
    parsed.format === "erya-names-encrypted-backup"
  ) {
    if (!password) throw new Error("encrypted-backup-password-required");
    return JSON.parse(await decryptBackup(parsed, password));
  }
  return parsed;
}
