# 项目资料索引

个人版入口：[使用指南](personal-guide.md) · [本轮资料核验](references/naming-research-20260927.md)。

`docs/` 保存项目开发需要长期引用的外部标准、来源说明和后续架构文档。产品规划与起名方法论的长期信源仍位于 Obsidian：

- `/Users/bytedance/Knowledge/obsidian/SowGrow/10.Projects/Active/erya-names/项目主页.md`
- `/Users/bytedance/Knowledge/obsidian/SowGrow/10.Projects/Active/erya-names/产品与起名规则基线.md`
- `/Users/bytedance/Knowledge/obsidian/SowGrow/10.Projects/Active/erya-names/起名规则与学习资料.md`

## 目录约定

| 路径                       | 内容                                     | 维护方式                                             |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| `references/standards/`    | 国家标准、官方规范及便于检索的文本转换稿 | 保留原始标题和版本；记录来源、用途、核验日期与校验值 |
| `architecture/`            | 后续经确认的系统架构与关键技术决策       | 由 plan 阶段创建；跟代码同生命周期                   |
| `data/sources/`            | 后续语料来源、许可证审计和字段说明       | 由 P0 数据基线阶段创建；不存放未审计原始缓存         |
| `performance-budget.md`    | 首屏、生成、千条候选筛选和静态资产预算   | 由自动化报告验证；放宽必须记录依据                   |
| `release-checklist.md`     | Preview 到 Production 的同产物发布门禁   | 只按真实 CI、部署和人工验收证据勾选                  |
| `architecture/overview.md` | 当前分层、持久化和发布架构               | 与代码 schema 和 release manifest 同步               |
| `support.md`               | 本地诊断、恢复和发布回滚步骤             | 不记录用户内容或敏感数据                             |

尚未产生内容的目录不提前创建。完整上游语料快照属于可重建的本地缓存，不放在 `docs/` 或前端发行包中。

## 标准资料

| 资料                             | 发布机构 / 标准号        | 仓内文件                                                                                                | 用途                         | 核验日期   | SHA-256                                                                                                                                             |
| -------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 《通用规范汉字表》               | 国务院，国发〔2013〕23号 | [`Markdown`](references/standards/通用规范汉字表.md) / [`PDF`](references/standards/通用规范汉字表.pdf) | L1 规范字校验依据            | 2026-09-17 | Markdown `b5d22c45d4b3518b2a8175b72b625fe6f8190c5c22f5ef3ded720ac1a6113fd4`；PDF `af85c706a53d3b3bbad818bcce7415ac9a2284ea14f79fe7f54ce1248a7bdac9` |
| 《汉语拼音正词法基本规则》       | GB/T 16159—2012          | [`Markdown`](references/standards/汉语拼音正词法基本规则.md)                                            | 拼音书写与格式参考           | 2026-09-17 | `b59c08ac9c2fb7d7dd4eaf6e60e5408b73a157e6ece1c3f4d7678bdc79da4c35`                                                                                  |
| 《中国人名汉语拼音字母拼写规则》 | GB/T 28039—2011          | [`Markdown`](references/standards/中国人名汉语拼音字母拼写规则.md)                                      | 姓名拼音展示与复姓、双姓规则 | 2026-09-17 | `33dd42550cc2e33cf27a90577f6aa5c0904cfbafbaceb6b49c0c749364c0e8c5`                                                                                  |

## 来源链接

- 《通用规范汉字表》：[中国政府网 PDF](http://www.gov.cn/govweb/xxgk/pub/govpublic/mrlm/201308/W020130822615096093968.pdf)
- GB/T 16159—2012：[教育部发布文件](http://www.moe.gov.cn/ewebeditor/uploadfile/2012/08/21/20120821100233165.pdf)
- GB/T 28039—2011：[教育部发布文件](http://www.moe.gov.cn/ewebeditor/uploadfile/2012/06/01/20120601104529410.pdf)

## 使用规则

- 仓内 Markdown 用于全文检索，PDF 用于版式和原始页码核验；发生差异时以发布机构原文为准。
- 引用标准时写明标准号或发文号，不把标准文本改写成民俗或审美结论。
- 新增资料前检查再分发许可；来源或许可不明确的资料只记研究线索，不复制到仓库。
- 约 100 MB 的 PDF 使用 Git LFS 管理；`.gitattributes` 已声明 `*.pdf filter=lfs diff=lfs merge=lfs -text`。如果目标远端不支持 Git LFS，应移出 PDF，只保留来源链接和 SHA-256。
