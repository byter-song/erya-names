import { useEffect, useState } from "react";
import { checkForUpdate } from "../../infrastructure/versioning/checkForUpdate";
import { AppUpdatePrompt } from "./AppUpdatePrompt";

export interface AppVersionWatcherProps {
  currentVersion: string;
  databaseVersion: number;
  fetcher?: typeof fetch;
  refresh?: () => void;
  prepareUpdate?: () => Promise<void>;
}

export function AppVersionWatcher({
  currentVersion,
  databaseVersion,
  fetcher,
  refresh = () => window.location.reload(),
  prepareUpdate = async () => undefined,
}: AppVersionWatcherProps) {
  const [latestVersion, setLatestVersion] = useState(currentVersion);
  const [compatible, setCompatible] = useState(true);

  useEffect(() => {
    let active = true;

    void checkForUpdate({
      currentVersion,
      databaseVersion,
      ...(fetcher ? { fetcher } : {}),
    })
      .then((result) => {
        if (active && result.available) {
          setLatestVersion(result.latestVersion);
          setCompatible(result.compatible);
        }
      })
      .catch(() => {
        // Version checks are advisory; a network failure must not block local work.
      });

    return () => {
      active = false;
    };
  }, [currentVersion, databaseVersion, fetcher]);

  return (
    <AppUpdatePrompt
      currentVersion={currentVersion}
      latestVersion={latestVersion}
      compatible={compatible}
      refresh={async () => {
        await prepareUpdate();
        refresh();
      }}
    />
  );
}
