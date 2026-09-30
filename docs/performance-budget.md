# 性能预算

本预算以 0.3.0 个人版构建为当前基线。预算只允许通过评审后收紧；若需放宽，必须记录真实用户场景、测量报告与原因。

| 指标                  |             门槛 | 说明                                             |
| --------------------- | ---------------: | ------------------------------------------------ |
| JavaScript raw / gzip | 1.05 MB / 350 kB | 包含按路由拆分页面与原生 Canvas 2D 动态泼墨      |
| CSS raw / gzip        |   140 kB / 50 kB | 包含黑金宣纸视觉、响应式导航和页面交互样式       |
| 字体资源总量          |            30 kB | 只允许仓内裁剪的标题字体；正文与打印使用系统字体 |
| 项目打开 P95          |         1,000 ms | 本地 IndexedDB、1,000 候选基准                   |
| 生成 20 个候选 P95    |         2,000 ms | 正式发布必须在 production bundle 上重新执行      |
| 1,000 候选筛选 P95    |           100 ms | 从输入到 DOM 稳定                                |

`npm run quality:bundle` 输出 `output/performance/bundle-budget.json`。浏览器运行时报告由 `tests/e2e/ui-performance.spec.ts` 生成。

2026-09-18 金线水墨交互重设计基线：JavaScript 约 957 kB / gzip 314 kB，CSS 约 33 kB / gzip 8 kB，字体资源 0；生成 P95 约 1423ms，1,000+ 候选打开 P95 约 131ms，筛选 P95 约 52ms；Lighthouse Performance 93、Accessibility 100、Best Practices 100。

2026-09-29 黑金水墨山水基线：JavaScript 约 1008 kB / gzip 343 kB，CSS 约 41 kB / gzip 13 kB，字体资源 0，原创 SVG 山水主景约 9.2 kB；48 名生成 P95 约 1305ms，1,000+ 候选打开 P95 约 148ms，筛选 P95 约 21.3ms；Lighthouse Performance 95、Accessibility 100、Best Practices 100。Canvas 首屏先绘静态墨晕，指针交互立即启动动态，环境动画延后启动并限制约 30 FPS；DPR 上限 1.5、动态粒子上限 120。

2026-09-30 双主题挥毫开卷基线：Ma Shan Zheng 正式标题子集 27,256 B；亮色使用雾青宣纸与墨绿侧栏，暗色使用挥毫开卷与深墨绿黑侧栏；移除运行时山水 SVG、双 Canvas、指针监听、导航过渡和持续环境动画；侧栏与方案恢复使用客户端路由，启动挥毫只在整页打开时出现；方案中心支持带二次确认的本地级联删除。JavaScript 1,006,624 B / gzip 341,267 B，CSS 48,000 B / gzip 15,037 B；Lighthouse Performance 95、Accessibility 100、Best Practices 100。
