# Erya Names — AI Context

> 本文件是 `erya_names` 的仓库上下文导航。产品与起名知识的长期信源位于 Obsidian，不在这里复制。

## 当前仓库事实

- 仓库已初始化为 React + TypeScript + Vite SPA，使用 npm lockfile 固化依赖。
- 当前 `src/` 已完成 production rewrite 的 Foundation、完整本地用户旅程、生产生成规则、单人决策工作流及备份恢复；Release Readiness 的本地门禁以 workspace `specs/20260917-production-rewrite/` 为准。
- 根目录 `Makefile` 是常用启动与验证入口；真实脚本以 [`package.json`](../package.json) 为准。
- 外部标准统一位于 [`docs/references/standards/`](../docs/references/standards/)，来源、用途和校验值见 [`docs/README.md`](../docs/README.md)。
- `ai-context/` 只保留仓库导航、工程契约、验证路径与必要索引，不存放外部标准全文。

## 治理模式

- `code_ownership: personal`
- `ai_context_mode: in_repo`
- 这是当前项目的会话级约定，不登记到 `lookalike_ai_workbench/repos.yaml`。
- `lookalike_ai_workbench` 仅提供 start、brainstorm、specify、plan、tasks、implement 等流程能力。

## 信源与落点

| 内容                                   | 权威落点                                       |
| -------------------------------------- | ---------------------------------------------- |
| 产品愿景、范围、里程碑                 | Obsidian `项目主页.md`                         |
| 起名规则、产品决策、民俗边界、数据准入 | Obsidian `产品与起名规则基线.md`               |
| 学习路径与资料清单                     | Obsidian `起名规则与学习资料.md`               |
| 国家标准与外部参考资料                 | 本仓 `docs/`                                   |
| 当前生产版设计与实现过程               | workspace `specs/20260917-production-rewrite/` |
| 代码结构、命令、数据契约和验证路径     | 本仓 `ai-context/`                             |
| 运行时字库、典故库和规则数据           | 本仓 `src/data/curated/`                       |

## 已确定的代码约束

- V1 为本地优先 Web 应用，无账号、无服务端和在线协作。
- 支持任意家庭创建多个彼此隔离的起名方案。
- 敏感数据保存在浏览器本地；支持删除、清空、JSON 备份恢复和脱敏 PDF 导出。
- 默认不接入统计、埋点、第三方分析或大模型接口。
- 个人版生成采用来源已核对的语料；无可靠古籍出处的名字标注为“现代组合命名”。
- 默认 personal 包可使用 source_checked（机器核对与 AI 整理）；公共 production 仍只接收真实人审 verified 记录。
- L1/L2 是硬约束，L3 用于基础系统分；L4 只在民俗候选阶段设置、重评和排序，不混入基础系统分。
- 传统民俗输出必须标注“传统民俗参考，非科学结论”；健康相关内容必须标注不构成医疗建议。

## 模块地图

| 模块       | 路径                                                                 | 说明                                             |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| App shell  | `src/app/`                                                           | 页面框架、内部路由和全局样式                     |
| 项目与向导 | `src/features/projects/`, `src/features/onboarding/`                 | 方案中心、创建向导和表单约束                     |
| 候选工作台 | `src/features/funnel/`, `src/features/comparison/`                   | 生成同页初选、候选详情、单人评价、对比和快照     |
| 定稿与导出 | `src/features/finalization/`, `src/features/backup/`                 | 最终决定、PDF、JSON/加密备份与恢复               |
| 领域模型   | `src/domain/`                                                        | 项目、候选、来源、规则、评价和民俗契约           |
| 生成与规则 | `src/domain/generation/`, `src/domain/rules/`                        | 候选生成、L1/L2/L3/L4 分层规则和不变量           |
| 民俗历法   | `src/domain/folklore/`                                               | `lunar-typescript` 封装、四柱和五行分布          |
| 数据       | `src/data/`, `data/`, `scripts/data/`                                | 运行时语料、来源与中间产物、数据管线脚本         |
| 存储       | `src/infrastructure/database/`, `src/infrastructure/repositories/`   | Dexie schema v4、迁移和仓储                      |
| 测试       | `tests/unit/`, `tests/integration/`, `tests/security/`, `tests/e2e/` | 领域、存储、UI、安全、可访问性、性能和浏览器旅程 |

## 构建与验证

当前基础工程已提供根目录 `Makefile` 作为统一入口：

| 任务         | 命令                   |
| ------------ | ---------------------- |
| 安装依赖     | `make install`         |
| 本地启动     | `make dev`             |
| 生产预览     | `npm run preview`      |
| 构建         | `make build`           |
| 格式检查     | `make format-check`    |
| 类型检查     | `make typecheck`       |
| Lint         | `make lint`            |
| 单元测试     | `make test`            |
| 端到端测试   | `make test-e2e`        |
| 完整本地门禁 | `make preflight`       |
| 发布本地门禁 | `make release-check`   |
| 构建发布产物 | `make release-prepare` |

## 当前发布事实

- 0.3 个人版规格：workspace `specs/20260927-naming-studio/`；使用说明见 `docs/personal-guide.md`。
- 默认 `personal-2026.10.15` 内容包：303 个字、396 条经过 `corpus-score-1` 准入的双字典故、600 个现代组合和 81 条历史用名参考，其中状元 30 条；source_checked 与生产人审 verified 分开。精选 TSV/JSON 是持久输入，构建不从原始大语料重新抽取名字。
- `data/sources/personal/standard-character-pinyin.json` 是覆盖 8,105 个通用规范汉字的持久拼音 SSOT；303 张 `characters` 仍是独立的自动生成白名单。
- `data/sources/personal/traditional-to-simplified.json` 是固定 OpenCC 来源生成的持久映射；繁体底本在精选构建和候选生成时先转换为简体，再进入字卡门禁与页面展示。
- `data/sources/personal/character-elements.json` 为全部 303 张生成字卡提供 `semantic-imagery-1` 五行文化意象与逐字理由；它是 source_checked 项目分类，不是唯一权威字表。
- 民俗报告和名字解释在 `src/features/insights/`；日柱支持午夜/晚子时口径，时辰不详只展示三柱。
- 生成与筛选合并到 `/generate`；旧 `/candidates` 保留重定向兼容。
- 方案中心的“继续方案”按持久化阶段进入 `/generate`、`/compare` 或 `/finalize`；旧 `/projects/:id` 地址会读取方案后跳转，不再停留在占位页。删除方案需二次确认，并在单个 Dexie 事务中清理全部项目从属记录。

- 应用版本 `0.3.0`，Dexie schema v4，项目备份 schema v4（可导入 v1/v2/v3/v4）。
- `public/_headers` 记录静态托管期望的安全头，`public/_redirects` 提供 SPA 深链 fallback；当前部署平台是 ESA Functions & Pages，远端验收需确认平台实际应用这些规则。
- `npm run release:prepare` 生成一次 `dist/` 和 `output/release/release-manifest.json`；`npm run release:verify` 验证该目录未发生改变。
- `npm run release:prepare:production` 是唯一生产数据构建入口：只有真实人审通过后才会生成 `releases/current.json` 并注入 production artifact。
- Chromium/WebKit 可在本机验证；Edge 通过 `npm run test:e2e:edge` 在安装 Microsoft Edge 的环境或 Windows CI 验证。
- 当前活跃界面为 `InkScrollShell` + `InkLongScrollPage`；顶部五个命名章节与备份入口，手机导航横向滚动并保持当前章可见。长卷按当前状态筛选，旧 `/candidates` 重定向到长卷。
- 正文、表单与打印使用系统字体；品牌字与大标题使用裁剪版 Ma Shan Zheng。当前长卷采用亮色纸墨金线；旧暗色 token 和原型不等于可切换的活跃主题。启动页显示真实语料加载状态，就绪即退出；长卷支持减少动态效果。
- 生产发布仍受两项硬门禁约束：真实人工复核的 production corpus，以及 preview/production 的同 artifact 提升和真人验收。

同一套命令也记录在 [`skill-build-run-test.md`](skill-build-run-test.md)，供 workbench preflight 读取。

## 阅读顺序

1. 仓库根 [`AGENTS.md`](../AGENTS.md)
2. 本文件
3. 当前 spec 与 Obsidian 产品基线
4. [`docs/README.md`](../docs/README.md) 及与任务相关的规范资料
5. 与任务相关的 `src/`、`scripts/`、`tests/` 文件

## 2026-10-15 长卷完善的当前契约

- 临时规格与验收：workspace `specs/20261015-scroll-completion/`。长卷旅程测试：`npm run test:e2e -- tests/e2e/scroll-journey.spec.ts`。旧 E2E 中仍有面向退役卡片/侧栏的断言，不能据此宣称全部发布门禁已通过。
- 状元灵感是可选生成源 `historical_inspiration`，使用已有记录并保留借字关系；不因身份加分。
- 生肖规则仅用于 `zodiacAdvisory` 展示，不接入生成、评分、排序或阶段 guard；家庭字表逐字匹配，首字排除姓氏。
- 旧候选推进、首选保存与报告生成重新检查当前家庭硬约束；历史证据保持。`relativeAvoidances` 支持逐亲属整名/同字/同音；同字与同音只比较名，同音按指定普通话拼音与候选现用拼音比较、不分声调。规则包 `core-rules-4`、家庭规则 `l1-family-constraint-2`。定稿允许 1–5 名，首选与理由持久化。
- 备份导入使用通过 schema 校验的完整 profile，不能手工重建部分 folklore 字段导致新配置丢失。
