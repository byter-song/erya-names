import { V3_STORES } from "./v3";

// V4 reserves canonical funnel stage values. Existing rows remain readable via
// the compatibility adapter; new writes use the V4 stage contract.
export const V4_STORES = V3_STORES;

export function upgradeToV4(): Promise<void> {
  // Additive version boundary only. Rewriting user decisions is intentionally
  // avoided so rollback/export adapters can still identify legacy values.
  return Promise.resolve();
}
