import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ApplicationProviders } from "./providers";
import { router } from "./router";
import { ReadOnlyRecoveryPage } from "../features/recovery/ReadOnlyRecoveryPage";
import { buildDiagnosticBundle } from "../infrastructure/diagnostics/buildDiagnosticBundle";
import { downloadJson } from "../infrastructure/export/downloadJson";
import { exportRawDatabase } from "../infrastructure/backup/exportRawDatabase";
import { createApplicationContainer } from "../infrastructure/container";
import {
  EryaDatabase,
  ERYA_DATABASE_NAME,
  ERYA_DATABASE_VERSION,
  ERYA_TABLES,
} from "../infrastructure/database/EryaDatabase";
import { DexieDataHealthRepository } from "../infrastructure/repositories/DexieDataHealthRepository";
import { CheckLocalDataHealth } from "../application/use-cases/CheckLocalDataHealth";
import { isFutureDexieDatabaseVersion } from "../infrastructure/database/versionCompatibility";

export async function bootstrap(root: HTMLElement): Promise<void> {
  const databases = await indexedDB.databases();
  const existingVersion = databases.find(
    (database) => database.name === ERYA_DATABASE_NAME,
  )?.version;
  if (
    existingVersion !== undefined &&
    isFutureDexieDatabaseVersion(existingVersion, ERYA_DATABASE_VERSION)
  ) {
    renderRecovery(root, {
      healthy: false,
      readOnly: true,
      errors: ["schema-incompatible"],
      databaseVersion: existingVersion,
      counts: {},
    });
    return;
  }

  const database = new EryaDatabase();
  try {
    const health = await new CheckLocalDataHealth(new DexieDataHealthRepository(database), {
      supportedVersion: ERYA_DATABASE_VERSION,
      requiredTables: [...ERYA_TABLES],
    }).execute();
    if (!health.healthy) {
      database.close();
      renderRecovery(root, health);
      return;
    }
    createRoot(root).render(
      <StrictMode>
        <ApplicationProviders container={createApplicationContainer({ database })}>
          <RouterProvider router={router} />
        </ApplicationProviders>
      </StrictMode>,
    );
  } catch {
    database.close();
    renderRecovery(root, {
      healthy: false,
      readOnly: true,
      errors: ["database-open-failed"],
      databaseVersion: existingVersion ?? 0,
      counts: {},
    });
  }
}

function renderRecovery(
  root: HTMLElement,
  health: {
    healthy: boolean;
    readOnly: boolean;
    errors: string[];
    databaseVersion: number;
    counts: Record<string, number>;
  },
) {
  createRoot(root).render(
    <ReadOnlyRecoveryPage
      health={health}
      onExportRawBackup={() =>
        void exportRawDatabase(ERYA_DATABASE_NAME).then((snapshot) =>
          downloadJson("erya-names-raw-database.json", snapshot),
        )
      }
      onExportDiagnostic={() =>
        downloadJson(
          "erya-names-diagnostic.json",
          buildDiagnosticBundle({
            appVersion: __APP_VERSION__,
            databaseVersion: health.databaseVersion,
            errors: health.errors,
            counts: health.counts,
          }),
        )
      }
    />,
  );
}
