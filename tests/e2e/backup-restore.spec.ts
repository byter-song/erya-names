import { expect, test } from "@playwright/test";
import { createProject } from "./helpers";

interface PersistedProjectSnapshot {
  pools: Record<string, string>;
  scores: Record<string, unknown>;
  evidence: Record<string, unknown>[];
}

async function readProjectSnapshot(
  page: import("@playwright/test").Page,
  projectId: string,
): Promise<PersistedProjectSnapshot> {
  return page.evaluate(async (targetProjectId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("erya-names-v2");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const readAll = <T>(storeName: string) =>
      new Promise<T[]>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as T[]);
      });
    const [candidates, decisions, scores, evidence] = await Promise.all([
      readAll<{ id: string; projectId: string; fullName: string }>("candidates"),
      readAll<{ projectId: string; candidateId: string; pool: string }>("candidateDecisions"),
      readAll<{
        projectId: string;
        candidateId: string;
        totalScore?: number;
        hardStatus: string;
        moduleScores: Record<string, number | undefined>;
      }>("candidateScores"),
      readAll<{
        projectId: string;
        candidateId: string;
        moduleId: string;
        ruleId: string;
        status: string;
        deduction?: number;
      }>("ruleEvidence"),
    ]);
    database.close();
    const names = new Map(
      candidates
        .filter(({ projectId }) => projectId === targetProjectId)
        .map(({ id, fullName }) => [id, fullName]),
    );
    const pools = Object.fromEntries(
      decisions
        .filter(({ projectId }) => projectId === targetProjectId)
        .map(({ candidateId, pool }) => [names.get(candidateId)!, pool])
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    const normalizedScores = Object.fromEntries(
      scores
        .filter(({ projectId }) => projectId === targetProjectId)
        .map(({ candidateId, totalScore, hardStatus, moduleScores }) => [
          names.get(candidateId)!,
          { totalScore, hardStatus, moduleScores },
        ])
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    const normalizedEvidence = evidence
      .filter(({ projectId }) => projectId === targetProjectId)
      .map(({ candidateId, moduleId, ruleId, status, deduction }) => ({
        fullName: names.get(candidateId),
        moduleId,
        ruleId,
        status,
        deduction,
      }))
      .sort((left, right) =>
        `${left.fullName}:${left.moduleId}:${left.ruleId}`.localeCompare(
          `${right.fullName}:${right.moduleId}:${right.ruleId}`,
        ),
      );
    return { pools, scores: normalizedScores, evidence: normalizedEvidence };
  }, projectId);
}

test("exports a project and restores the validated backup as a copy", async ({ page }) => {
  const projectId = await createProject(page);
  await page.goto(`/projects/${projectId}/config#configuration-basics`);
  await page.getByRole("button", { name: "基础", exact: true }).click();
  await page.getByRole("button", { name: "添加风格" }).click();
  await page.getByRole("textbox", { name: "风格偏好 1", exact: true }).fill("清朗自然");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText("分析完成")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("link", { name: "进入名字长卷" }).click();
  for (let moved = 1; moved <= 2; moved += 1) {
    const name = await page.locator(".ils__panel.is-center h2").innerText();
    await page.getByRole("button", { name: `选择${name}进入下一阶段` }).click();
    await expect(page.getByRole("button", { name: `候选池（${moved}）` })).toBeVisible();
  }
  await page.getByRole("button", { name: "候选池（2）" }).click();
  const selectedName = await page.locator(".ils__panel.is-center h2").innerText();
  await page.getByRole("button", { name: `选择${selectedName}进入下一阶段` }).click();
  await expect(page.getByRole("button", { name: "精选池（1）" })).toBeVisible();
  const before = await readProjectSnapshot(page, projectId);
  expect(Object.values(before.pools)).toContain("selected");
  expect(Object.keys(before.scores)).not.toHaveLength(0);
  expect(before.evidence).not.toHaveLength(0);

  await page.goto(`/projects/${projectId}/backup`);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON 备份" }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error("Expected a downloaded backup path");

  await page.goto("/recovery");
  await page.getByLabel("选择备份文件").setInputFiles(downloadedPath);
  await expect(page.getByText("检测到同 ID 方案")).toBeVisible();
  await page.getByLabel("冲突处理方式").selectOption("import-copy");
  await page.getByRole("button", { name: "确认恢复" }).click();
  const status = page.getByRole("status");
  await expect(status).toContainText("恢复完成");
  const restoredProjectId = (await status.textContent())?.match(/恢复完成：(.+)/)?.[1]?.trim();
  expect(restoredProjectId).toBeTruthy();
  expect(restoredProjectId).not.toBe(projectId);
  expect(await readProjectSnapshot(page, restoredProjectId!)).toEqual(before);
});

test("shows a useful error for a damaged backup without leaving the recovery page", async ({
  page,
}) => {
  await page.goto("/recovery");
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "damaged-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"invalid":true}'),
  });

  await expect(page.getByRole("alert")).toContainText("unsupported-format");
  await expect(page).toHaveURL(/\/recovery$/);
  await expect(page.getByRole("button", { name: "重新预览备份" })).toBeVisible();
});
