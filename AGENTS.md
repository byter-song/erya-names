# Erya Names — Agents Guide

## 项目身份

- 名称：尔雅起名（Erya Names）
- 仓库：`erya_names`
- 性质：个人项目；`code_ownership: personal`，`ai_context_mode: in_repo`
- 目标：构建面向任意家庭、可重复使用的中文起名 Web 应用
- 主语言：TypeScript；当前工程为 React + Vite + TanStack Router + Dexie

## 阅读顺序

1. [`ai-context/AGENTS.md`](ai-context/AGENTS.md)
2. [`docs/README.md`](docs/README.md)
3. Obsidian 项目主页：`/Users/bytedance/Knowledge/obsidian/SowGrow/10.Projects/Active/erya-names/项目主页.md`
4. Obsidian 产品基线：`/Users/bytedance/Knowledge/obsidian/SowGrow/10.Projects/Active/erya-names/产品与起名规则基线.md`
5. 当前个人版需求：`/Users/bytedance/Dev/personal/erya/specs/20260927-naming-studio/`；原生产版基线保留在 `specs/20260917-production-rewrite/`。

## 知识边界

- Obsidian 是产品规划、起名方法论、民俗边界和资料研究的长期 SSOT。
- `ai-context/` 只记录仓库结构、代码契约、命令、验证路径和必要资料索引。
- `docs/` 保存外部标准、来源说明和经确认的架构文档；目录索引见 [`docs/README.md`](docs/README.md)。
- 应用运行所需的字库、典故库和规则数据进入代码仓库时，必须保留来源、核验状态和核验日期。
- `lookalike_ai_workbench` 仅提供工作流能力；本项目不登记到其 `repos.yaml`。

## 硬约束

- 合规、规范字和真实使用风险优先于审美与传统民俗偏好。
- 八字、喜用神、五格、生肖及人生解读必须标注为传统民俗参考，不表述为科学结论。
- 健康相关内容不得构成医疗建议。
- V1 默认本地处理数据，不上传敏感家庭信息，不接入埋点或第三方分析。
- 不复制禁止转载的网站内容；只使用获得授权、可合法使用或自行基于权威来源整理的内容。

## 开发规则

- 优先最小必要修改；实现前先确认当前 spec、产品基线和工作区状态。
- 不在 `master` 直接开发，不自动提交、推送或创建 PR。
- 构建、测试和运行命令必须以仓库当前 `package.json` 为准；工程尚未初始化时不得猜测。
- 发布前执行 `make release-check`；生产语料审计、Edge、preview 和 production 是独立外部门禁，不得用本地开发包冒充通过。
- 修改规则数据时，验证硬门槛、来源追踪、民俗开关和本地隐私边界。
