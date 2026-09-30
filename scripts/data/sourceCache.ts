import { access, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

export interface SourceCachePaths {
  target: string;
  temporary: string;
  backup: string;
}

export async function prepareCachePaths(
  root: string,
  sourceId: string,
  processId: number,
): Promise<SourceCachePaths> {
  await mkdir(root, { recursive: true });
  return {
    target: path.join(root, sourceId),
    temporary: path.join(root, `${sourceId}.tmp-${processId}`),
    backup: path.join(root, `${sourceId}.backup-${processId}`),
  };
}

export async function promoteVerifiedCache(
  paths: SourceCachePaths,
  hooks: { beforePromote?: () => void } = {},
): Promise<void> {
  const hadTarget = await exists(paths.target);
  await rm(paths.backup, { recursive: true, force: true });
  if (hadTarget) await rename(paths.target, paths.backup);
  try {
    hooks.beforePromote?.();
    await rename(paths.temporary, paths.target);
    await rm(paths.backup, { recursive: true, force: true });
  } catch (error) {
    if (hadTarget && (await exists(paths.backup))) await rename(paths.backup, paths.target);
    throw error;
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
