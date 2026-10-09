# 发布与交付检查

## 0.3 个人版

本版本默认使用 `personal-2026.09.30`。个人内容来源核对与公共 production 的人审流程分开，不能互相代替。

- 主版本已完成 `make release-check`（含依赖、类型、lint、单元/集成、数据、安全、性能、可访问性、Chromium/WebKit E2E、Lighthouse 与产物校验）。
- 追加的 500 现代组合已完成全量生成校验，最终产物已重新通过完整发布检查；组合质量、性能、Lighthouse 与产物结果分别见 `output/quality/modern-combinations.json`、`output/performance/`、`output/lighthouse/scores.json` 和 `output/release/release-manifest.json`。
- 当前构建哈希以 `output/release/release-manifest.json` 为准，不在文档硬编码旧值。
- 产物生成：`npm run release:prepare`；核对：`npm run release:verify`。
- 使用入口与隐私说明：[个人使用指南](personal-guide.md)。

## V4.0/V4.1 五阶段实现候选（2026-10-08）

当前结论：**实现候选可本地体验，发布 No-Go**。

- 数据库版本：v4；项目备份 schema：v3。
- 已完成：format、typecheck、lint、251 项 unit/integration、build、Chromium 主流程/无障碍/移动/性能与 WebKit 多定稿主流程。
- 当前工作区包含实现前既有未提交改动，尚未生成本次受控 release artifact；artifact hash：**未签署**。
- [ ] T027–T033 HUMAN-ONLY 目标家庭用户测试及原始证据。
- [ ] 正式实现双角色复评 P0/P1 清零。
- [ ] 产品所有者 T041 发布 Go/No-Go 签署。
- [ ] `npm run release:prepare` 后记录本次 `output/release/release-manifest.json` hash，并完成同 artifact 验收。

在以上项目完成前，不得用 0.3 的历史 release-check 结果代表本次 V4 制品通过。

## 公共生产发布的独立门槛

以下没有执行，不能标注为通过：

- [ ] 800–1,200 字和 300–500 条典故的真实人工审校生产语料。
- [ ] `npm run release:prepare:production` 使用审核后的 production 数据。
- [ ] 桌面 Microsoft Edge 实测（当前本机未安装）。
- [ ] 远端 preview 部署、服务器安全头检查及真人验收。
- [ ] 同一个已验收产物提升到远端 production，并记录 URL 和回滚版本。

个人本地使用不依赖这些公共发布步骤。无账号、无服务器和外部 API Key；仍需妥善保存本地备份。
