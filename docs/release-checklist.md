# 发布与交付检查

## 0.3 个人版

本版本默认使用 `personal-2026.09.27`。个人内容来源核对与公共 production 的人审流程分开，不能互相代替。

- 主版本已完成 `make release-check`（含依赖、类型、lint、单元/集成、数据、安全、性能、可访问性、Chromium/WebKit E2E、Lighthouse 与产物校验）。
- 追加的 500 现代组合已完成全量生成校验，最终产物已重新通过完整发布检查；结果见 `output/test/release-check.log`、`output/quality/modern-combinations.json`。
- 当前构建哈希以 `output/release/release-manifest.json` 为准，不在文档硬编码旧值。
- 产物生成：`npm run release:prepare`；核对：`npm run release:verify`。
- 使用入口与隐私说明：[个人使用指南](personal-guide.md)。

## 公共生产发布的独立门槛

以下没有执行，不能标注为通过：

- [ ] 800–1,200 字和 300–500 条典故的真实人工审校生产语料。
- [ ] `npm run release:prepare:production` 使用审核后的 production 数据。
- [ ] 桌面 Microsoft Edge 实测（当前本机未安装）。
- [ ] 远端 preview 部署、服务器安全头检查及真人验收。
- [ ] 同一个已验收产物提升到远端 production，并记录 URL 和回滚版本。

个人本地使用不依赖这些公共发布步骤。无账号、无服务器和外部 API Key；仍需妥善保存本地备份。
