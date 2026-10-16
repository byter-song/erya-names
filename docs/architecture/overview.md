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
- 数据库：`erya-names-v2` version 1，固定 13 表；没有旧迁移链
- 项目备份：严格 v2 契约，校验 checksum 后导入；拒绝旧版本和额外旧表字段
- 默认个人数据包：`personal-2026.10.15`，303 字、396 条双字典故、600 个现代组合和 81 条历史用名参考；303 张字卡均包含可解释的五行文化意象。`source_checked` 表示来源核对而非人工审核。
- 开发数据包：`dev-2026.09.17`，不得作为 production corpus
- 规则与评分版本由当前运行时包和评分运行记录共同保存

## 持久化约束

- 所有项目数据保存在本机 `erya-names-v2` IndexedDB。
- 跨表状态变更在同一个 Dexie transaction 内完成。
- 候选只使用 `inspiration`、`candidate`、`selected`、`excluded` 四种池状态；精选数量不限。
- 排除操作保存最近活跃池，支持恢复；永久清理必须再次确认。
- 配置、候选、评分、评分证据、评价和备份均以 v2 数据模型为唯一事实源。

## 发布模型

- `npm run release:prepare` 生成一次 `dist/` 与 release manifest。
- `npm run release:verify` 校验后续使用的 `dist/` 与 manifest 完全一致。
- ESA Functions & Pages 负责 HTTPS 静态托管；无 Service Worker、远程字体、埋点或第三方脚本。
- `public/_headers` 记录期望的安全响应头；远端发布验收必须确认 ESA 实际应用这些响应头，不能只以本地文件存在作为通过依据。
- 生产内容与应用代码独立版本化；没有真实人工复核的 production bundle 时禁止正式发布。
- `ERYA_DATASET_MODE` 默认 personal；development 使用 fixture，production 必须使用人审后的 `src/data/curated/releases/current.json`。Vite 将语料生成为带哈希的同源 JSON，启动先加载并校验结构，再加载应用；失败提供重试。应用、benchmark 和 manifest 使用同一内容选择器。
- `/config` 统一配置基础规则与民俗模块，`/names` 承载生成、四池、详情和比较，`/export` 输出精选名单。
- 建档通过单事务写入完整方案；评分与备注串行保存。保存影响评分的配置后，既有候选按评分输入哈希异步重算。
