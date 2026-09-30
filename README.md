# 尔雅起名 · 个人版

为中国宝宝选一个可以认真解释、反复比较的名字。以宣纸、青绿水墨与金线构成工作台；方案和家庭信息只保存在当前浏览器中。

## 启动

需要 Node.js 22.12+。已经安装依赖时直接运行：

```sh
make dev
```

打开 <http://127.0.0.1:5173>。首次安装使用 `npm ci`。固定使用同一浏览器、同一地址和端口；更换浏览器或端口前先导出备份。

本地生产构建与预览：

```sh
make build
make preview
```

预览地址默认 <http://127.0.0.1:4173>。预览端口与开发端口是不同的浏览器存储空间，可通过备份恢复迁移。

### 发布到 ESA Pages

当前线上 routine 为 `erya-names`。本地完成修改后，执行：

```sh
make publish
```

`make publish` 默认等价于 `make publish-esa`：它会重新构建、生成并校验 release manifest，再把当前 `dist/` 发布到 ESA Functions & Pages。它不会修改域名、DNS 或证书。首次使用前，需要已配置有效的阿里云 CLI 凭证，并在本机安装 `alibabacloud-esa-pages-deploy` Skill 及其依赖。

如需发布到另一个 ESA routine，显式指定名称：

```sh
make publish-esa ESA_ROUTINE=erya-names-preview
```

## 使用流程

1. 创建方案，填写姓氏、避字、风格和可选的出生信息。
2. 在「生名与初选」选择每批 24、48 或 96 个名字。生成、搜索、筛选、读解释都在同页。
3. 点击「收入候选」才会进入「我的候选」；可评分、备注、加入对比。暂不考虑的名字可恢复，当前会话支持撤销。
4. 比较 2–5 个名字，将其中 3–5 个列为最终候选，记录最终选择与理由。
5. 预览定稿报告，选择隐藏出生、民俗或备注后打印为 PDF。通过「备份与导出」保存 JSON 或密码加密备份。

详细说明见 [个人使用指南](docs/personal-guide.md)，验收结果见 [交付记录](docs/delivery-0.3.md)，内容来源见 [资料核验记录](docs/references/naming-research-20260927.md)。

## 版本与内容

- 应用 0.3.0；数据库 v3，备份 v2（支持旧版恢复）。
- 默认内容包 `personal-2026.09.27`：303 个用字、62 条古籍取名记录，以及 **500 个**编辑整理的现代组合。
- 个人内容采用原文、读音、规范字与笔画交叉检查，释义由 AI 独立整理。`source_checked` 明确表示来源已核对，不冒充专家逐条人工审校。
- 现代组合按单字含义解释；不伪造典故。民俗默认关闭，解释计算口径，不推断命运、不自动判断喜用神。
- 默认无需账号、API Key 或付费模型；运行时不调用外部起名接口，不上传家庭信息。

## 验证与维护

```sh
npm run data:build-personal  # 从仓内来源资料重建个人语料
npm run data:audit          # 规范字、引用、许可和内容哈希
npm run quality:combinations # 500 组合的全量生成与解释一致性
make preflight             # 格式、类型、lint、单元/集成、数据与构建
make release-check         # 另含安全、性能、浏览器、可访问性与产物校验
```

`dist/` 是静态站点；完整构建产物的版本与哈希由 `npm run quality:manifest` 记录。个人版可直接在本机使用。公共 production 语料的人工审核、Edge 实测及远端托管验收是独立发布步骤，不能用个人包的本地通过结果代替。
