import type { Transaction } from "dexie";
import { V2_STORES } from "./v2";

export const V3_STORES = V2_STORES;

export async function upgradeToV3(transaction: Transaction): Promise<void> {
  await transaction
    .table("candidates")
    .toCollection()
    .modify((candidate) => {
      if (!Array.isArray(candidate.characterEvidence)) candidate.characterEvidence = [];
    });
}
