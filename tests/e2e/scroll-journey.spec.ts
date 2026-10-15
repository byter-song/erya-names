import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function chapter(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "命名长卷阶段" })
    .getByRole("button", { name: label })
    .click();
}

test("long scroll: generate, advise without blocking, finalize, export and restore", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
  await page.getByLabel("方案名称", { exact: true }).fill("长卷自动验收");
  await page.getByLabel("姓氏", { exact: true }).fill("林");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("radio", { name: "没有", exact: true }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await page.getByRole("button", { name: "展卷 · 生成 9 个名字" }).click();
  await expect(page.getByRole("heading", { name: "灵感池 9 个" })).toBeVisible();
  await page.locator(".ils__scroller").focus();
  await page.keyboard.press("End");
  await expect(page.locator(".ils__paging")).toContainText("9 / 9");
  await page.keyboard.press("Home");
  await expect(page.locator(".ils__paging")).toContainText("1 / 9");
  const name = await page.locator(".ils__panel.is-center h2").innerText();
  await page
    .locator(".ils__panel.is-center")
    .getByRole("button", { name: `查看${name}详情` })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "个人评分" }).selectOption("5");
  await dialog.getByRole("textbox", { name: "心选理由" }).fill("日常叫名顺口");
  await dialog.getByRole("button", { name: "保存评价" }).click();
  await expect(dialog.getByRole("status")).toHaveText("评价已保存");
  await dialog.getByRole("button", { name: "保留到基础候选" }).click();
  await chapter(page, "02 基础候选");
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await expect(dialog.getByRole("textbox", { name: "心选理由" })).toHaveValue("日常叫名顺口");
  await dialog.getByRole("button", { name: "进入民俗候选", exact: true }).click();
  await chapter(page, "03 民俗候选");
  await page.getByRole("button", { name: "民俗设置", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "采用传统民俗参考" }).check();
  await dialog.getByLabel("民俗出生时间", { exact: true }).fill("2026-05-12T10:00");
  await dialog.getByText("添加家庭生肖提醒", { exact: true }).click();
  await dialog.getByLabel("提醒字表", { exact: true }).fill(name[1]!);
  await dialog.getByLabel("提醒内容", { exact: true }).fill("测试家庭首字提醒");
  await dialog.getByLabel("来源与口径", { exact: true }).fill("验收样例口述");
  await dialog.getByRole("button", { name: "加入提醒草稿" }).click();
  await dialog.getByRole("button", { name: "保存并重新评估民俗候选" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "已更新" })).toBeVisible();
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: `查看${name}详情` }).click();
  await expect(dialog.getByRole("region", { name: "生肖选字提示" })).toContainText(
    "命中家庭生肖提醒",
  );
  await dialog.screenshot({ path: testInfo.outputPath("detail-mobile.png") });
  await dialog.getByRole("button", { name: "加入重点候选", exact: true }).click();
  await page.getByRole("button", { name: "并卷比较", exact: true }).click();
  await page.getByRole("button", { name: "加入定稿名单", exact: true }).click();
  await page.getByRole("button", { name: "查看定稿名单", exact: true }).click();
  await page.getByRole("combobox", { name: "选择首选名字" }).selectOption({ label: name });
  await page
    .getByRole("textbox", { name: "家庭选择理由", exact: true })
    .fill("家人试读一致认可");
  await page.getByRole("button", { name: "保存首选与理由" }).click();
  await expect(page.getByRole("status")).toHaveText("首选和选择理由已保存");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "家庭选择理由", exact: true })).toHaveValue(
    "家人试读一致认可",
  );
  await expect(page.getByRole("textbox", { name: `${name}的保留理由` })).toHaveValue(
    "日常叫名顺口",
  );
  const textDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出定稿名单", exact: true }).click();
  const textPath = testInfo.outputPath("final-list.txt");
  await (await textDownload).saveAs(textPath);
  expect(await readFile(textPath, "utf8")).toContain("家人试读一致认可");
  await page.getByRole("button", { name: "查看定稿报告 / 打印 PDF" }).click();
  await expect(page.locator(".final-report")).toContainText("家人试读一致认可");
  await expect(page.locator(".final-report")).not.toContainText("2026-05-12");
  await page.getByRole("checkbox", { name: /报告包含出生信息/ }).check();
  await expect(page.locator(".final-report")).toContainText("测试家庭首字提醒");
  await page.screenshot({ path: testInfo.outputPath("report-mobile.png"), fullPage: true });
  await chapter(page, "06 备份");
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON 备份" }).click();
  const backupPath = testInfo.outputPath("backup.json");
  await (await backupDownload).saveAs(backupPath);
  expect(JSON.parse(await readFile(backupPath, "utf8")).schemaVersion).toBe(4);
  await page.getByRole("link", { name: "恢复已有备份" }).click();
  await page.getByLabel("选择备份文件", { exact: true }).setInputFiles(backupPath);
  await expect(page.getByRole("region", { name: "恢复预览" })).toContainText("候选 9 条");
  await page.getByRole("combobox", { name: "冲突处理方式" }).selectOption("import-copy");
  await page.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByRole("status")).toContainText("恢复完成");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await page.getByRole("link", { name: "返回方案中心", exact: true }).click();
  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "长卷自动验收（副本）", exact: true }) })
    .getByRole("link", { name: "继续方案" })
    .click();
  await expect(page.getByRole("textbox", { name: "家庭选择理由", exact: true })).toHaveValue(
    "家人试读一致认可",
  );
  await chapter(page, "01 灵感池");
  await page.getByRole("button", { name: "民俗设置", exact: true }).click();
  await expect(dialog).toContainText("测试家庭首字提醒");
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();
  await page.getByRole("button", { name: "灵感来源", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "诗词典故", exact: true }).uncheck();
  await dialog.getByRole("checkbox", { name: "现代风格", exact: true }).uncheck();
  await dialog.getByRole("checkbox", { name: "状元用名灵感", exact: true }).check();
  await dialog.getByRole("button", { name: "保存灵感来源" }).click();
  await expect(dialog.getByRole("status")).toContainText("已保存");
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();
  await page.getByRole("button", { name: "续卷 · 再生成 9 个" }).click();
  await expect(page.getByRole("heading", { name: "灵感池 17 个" })).toBeVisible();
  await page.locator(".ils__scroller").focus();
  await page.keyboard.press("End");
  await expect(page.locator(".ils__paging")).toContainText("17 / 17");
  await expect(page.locator(".ils__panel.is-center")).toContainText("状元灵感");
  await page
    .locator(".ils__panel.is-center")
    .getByRole("button", { name: /查看.*详情/ })
    .click();
  await expect(dialog).toContainText("关系：");
  await expect(dialog.getByRole("link", { name: "核对人物记录 ↗" })).toHaveAttribute(
    "href",
    /^https:/,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("manual candidates support comparison snapshots, exclusion, undo and recovery", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).first().click();
  await page.getByLabel("方案名称", { exact: true }).fill("手工候选验收");
  await page.getByLabel("姓氏", { exact: true }).fill("林");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("radio", { name: "没有", exact: true }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  const dialog = page.getByRole("dialog");
  for (const name of ["林清和", "林知远"]) {
    await page.getByRole("button", { name: "手工添加姓名" }).click();
    await dialog.getByLabel("完整姓名", { exact: true }).fill(name);
    await dialog.getByLabel("来源说明", { exact: true }).fill("家庭自拟");
    await dialog.getByLabel("释义", { exact: true }).fill("手工灵感，先作读音与规范检查");
    await dialog.getByRole("button", { name: "保存手工候选" }).click();
    await page.getByRole("button", { name: `查看${name}详情` }).click();
    await dialog.getByRole("button", { name: "保留到基础候选" }).click();
    await chapter(page, "02 基础候选");
    await page.getByRole("button", { name: `查看${name}详情` }).click();
    await dialog.getByRole("button", { name: "跳过民俗，加入重点候选" }).click();
    await chapter(page, "01 灵感池");
  }
  await page.getByRole("button", { name: "并卷比较", exact: true }).click();
  await page.getByRole("textbox", { name: "快照名称" }).fill("家人第一轮");
  await page.getByRole("button", { name: /保存.*快照/ }).click();
  await expect(page.getByText("对比快照已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "将林清和移回基础候选" }).click();
  await chapter(page, "02 基础候选");
  await page.getByRole("button", { name: "查看林清和详情" }).click();
  await dialog.getByText("暂不考虑这个名字", { exact: true }).click();
  await dialog.getByRole("textbox", { name: "排除理由（可选）" }).fill("想继续比较其他意象");
  await dialog.getByRole("button", { name: "排除", exact: true }).click();
  await expect(page.getByRole("heading", { name: "基础候选 0 个" })).toBeVisible();
  await page.getByRole("button", { name: "撤销上一步" }).click();
  await expect(page.getByRole("heading", { name: "基础候选 1 个" })).toBeVisible();
  await page.getByRole("button", { name: "查看林清和详情" }).click();
  await dialog.getByText("暂不考虑这个名字", { exact: true }).click();
  await dialog.getByRole("button", { name: "排除", exact: true }).click();
  await page.getByRole("button", { name: "暂不考虑 (1)" }).click();
  await page.getByRole("button", { name: "查看林清和详情" }).click();
  await dialog.getByRole("button", { name: "恢复到灵感池" }).click();
  await chapter(page, "01 灵感池");
  await expect(page.getByRole("button", { name: "查看林清和详情" })).toBeVisible();
});

test("relative-specific sound taboos are editable and recheck an existing name", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "展新卷 · 新建方案" }).click();
  await page.getByLabel("姓氏", { exact: true }).fill("林");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("radio", { name: "没有", exact: true }).check();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "完成建档，开始选名" }).click();
  await page.getByRole("button", { name: "手工添加姓名" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("完整姓名", { exact: true }).fill("林清扬");
  await dialog.getByLabel("来源说明", { exact: true }).fill("测试家庭自拟");
  await dialog.getByLabel("释义", { exact: true }).fill("清朗");
  await dialog.getByRole("button", { name: "保存手工候选" }).click();
  await page.getByRole("button", { name: "调整条件" }).click();
  await dialog.getByText("添加亲属避讳", { exact: true }).click();
  await dialog.getByLabel("亲属完整姓名", { exact: true }).fill("林庆和");
  await dialog
    .getByRole("combobox", { name: "避讳范围", exact: true })
    .selectOption("same-sound");
  await dialog.getByLabel("亲属的名（不含姓）", { exact: true }).fill("庆和");
  await dialog.getByLabel("亲属名的普通话读音", { exact: true }).fill("qing he");
  await dialog.getByRole("button", { name: "加入避讳草稿" }).click();
  await dialog.getByRole("button", { name: "保存起名条件" }).click();
  await expect(dialog.getByRole("status")).toContainText("条件已保存");
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();
  await expect(page.locator(".ils__panel.is-center")).toContainText("与亲属林庆和的名同音");
  await page.getByRole("button", { name: "保留到基础候选", exact: true }).click();
  await chapter(page, "02 基础候选");
  await page.getByRole("button", { name: "查看林清扬详情" }).click();
  await dialog.getByRole("button", { name: "跳过民俗，加入重点候选" }).click();
  await expect(dialog.locator(".ils__decisions").getByRole("alert")).toContainText("同音");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "调整条件" }).click();
  await dialog.getByRole("button", { name: "删除林庆和的避讳" }).click();
  await dialog
    .getByRole("combobox", { name: "必须遵守的字辈或避讳", exact: true })
    .selectOption("none");
  await dialog.getByRole("button", { name: "保存起名条件" }).click();
  await expect(dialog.getByRole("status")).toContainText("条件已保存");
  await dialog.getByRole("button", { name: "完成并返回长卷" }).click();
  await page.getByRole("button", { name: "查看林清扬详情" }).click();
  await dialog.getByRole("button", { name: "跳过民俗，加入重点候选" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "并卷比较", exact: true }).click();
  await expect(page.locator(".comparison-page")).toContainText("林清扬");
});
