// 尔雅只保留亮色长卷设计，主题切换已移除。
export type Theme = "light";

export function applyTheme(theme: Theme = "light"): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
