import type { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { namingProfileFixture } from "./namingProfile";
export async function seedDecisionWorkspace(
  database: EryaDatabase,
  projectId = "p1",
  ids = ["c1", "c2", "c3", "c4", "c5", "c6"],
) {
  await database.profiles.put(namingProfileFixture(projectId));
  await database.candidates.bulkPut(
    ids.map((id, i) => ({
      id,
      projectId,
      batchId: null,
      normalizedFingerprint: `宋清${["扬", "和", "安", "宁", "远", "知"][i % 6]}`,
      surname: "宋",
      givenName: `清${["扬", "和", "安", "宁", "远", "知"][i % 6]}`,
      fullName: `宋清${["扬", "和", "安", "宁", "远", "知"][i % 6]}`,
      pinyin: [],
      sourceType: "user_input",
      summary: "测试姓名",
      createdAt: "2026-10-15T00:00:00.000Z",
    })),
  );
}
