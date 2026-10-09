# 系统架构

尔雅起名是无账号、无服务端的浏览器 SPA。React 页面只调用 application use case；领域规则不依赖 React、Dexie 或浏览器 API；infrastructure adapter 负责 IndexedDB、备份、导出和版本检查。

```text
UI / routes
  -> application use cases + ports
    -> domain rules and entities
  -> infrastructure adapters
    -> one Dexie database
```

## 关键版本

- 应用版本：`0.3.0`
- Dexie schema：v3
- 项目备份 schema：v2，可在原始 checksum 验证后导入 v1
- 默认个人数据包：`personal-2026.09.30`，303 字、396 条双字典故和 66 条历史用名参考；303 张字卡均包含可解释的五行文化意象。`source_checked` 表示来源核对而非人工审核。
- 开发数据包：`dev-2026.09.17`，不得作为 production corpus
- 规则包：`core-rules-3`

## 持久化约束

- 所有项目数据保存在本机 `erya-names` IndexedDB。
- 跨表状态变更在同一个 Dexie transaction 内完成。
- 最终决定只在 3–5 个 finalist 且所选姓名属于 finalist 时写入。
- finalist 集合变化会使旧最终决定失效，并将项目恢复为 active/comparison。
- v2/v3 数据库迁移保留有效旧快照，并为旧候选补明确的空单字证据。

## 发布模型

- `npm run release:prepare` 生成一次 `dist/` 与 release manifest。
- `npm run release:verify` 校验后续使用的 `dist/` 与 manifest 完全一致。
- ESA Functions & Pages 负责 HTTPS 静态托管；无 Service Worker、远程字体、埋点或第三方脚本。
- `public/_headers` 记录期望的安全响应头；远端发布验收必须确认 ESA 实际应用这些响应头，不能只以本地文件存在作为通过依据。
- 生产内容与应用代码独立版本化；没有真实人工复核的 production bundle 时禁止正式发布。
- `ERYA_DATASET_MODE` 默认 personal；development 使用 fixture，production 必须使用人审后的 `src/data/curated/releases/current.json`。Vite 将语料生成为带哈希的同源 JSON，启动先加载并校验结构，再加载应用；失败提供重试。应用、benchmark 和 manifest 使用同一内容选择器。
- `/generate` 统一承载生成、初选和候选集；旧 `/candidates` 重定向到该页。inbox 是灵感，favorite/comparison/finalist 才计入候选。
- 建档通过单事务写入完整方案；评分与备注串行保存，避免快速交互覆盖新内容。民俗新增字段为可选字段，兼容既有 v3 数据与备份 v2。
