# 本地支持与恢复

## 常用命令

- 启动：`make dev`
- 基础门禁：`make preflight`
- 本地发布门禁：`make release-check`
- 构建并生成 manifest：`make release-prepare`
- 验证构建未改变：`npm run release:verify`

## 用户数据问题

1. 不要清空浏览器站点数据。
2. 优先从只读恢复页导出 raw database 和不含内容的 diagnostic bundle。
3. 使用 JSON 或加密备份的“预览”确认项目 ID、数量和冲突策略。
4. 只有完整校验通过后才能执行 replace 或 import-copy。
5. 迁移失败时保留原数据库并停留在只读恢复模式。

## 发布故障

1. 记录生产 artifact SHA-256、应用/DB/备份/数据/规则版本。
2. 与 CI release manifest 比对；不一致时停止发布。
3. 回滚到上一份已验收的完整 `dist/`，不要在 production 环境重新构建。
4. 对 direct route、版本提示、项目打开和备份导入做 smoke。
