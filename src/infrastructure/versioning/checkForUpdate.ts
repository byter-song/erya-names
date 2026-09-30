import { z } from "zod";

const versionManifestSchema = z.object({
  appVersion: z.string().min(1),
  buildHash: z.string().min(1),
  minimumDatabaseVersion: z.number().int().positive(),
  maximumDatabaseVersion: z.number().int().positive(),
});

export interface UpdateCheckResult {
  available: boolean;
  compatible: boolean;
  latestVersion: string;
  buildHash: string;
}

export async function checkForUpdate(input: {
  currentVersion: string;
  databaseVersion: number;
  fetcher?: typeof fetch;
}): Promise<UpdateCheckResult> {
  const response = await (input.fetcher ?? fetch)("/version.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Version check failed with HTTP ${response.status}`);
  }

  const manifest = versionManifestSchema.parse(await response.json());
  return {
    available: manifest.appVersion !== input.currentVersion,
    compatible:
      input.databaseVersion >= manifest.minimumDatabaseVersion &&
      input.databaseVersion <= manifest.maximumDatabaseVersion,
    latestVersion: manifest.appVersion,
    buildHash: manifest.buildHash,
  };
}
