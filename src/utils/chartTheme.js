/**
 * 图表主题配色：从全局 CSS 变量读取，保证 ECharts 的轴文字 / 轴线条 / 分割线 / tooltip
 * 与自定义样式（--text-secondary / --border / --surface 等）保持同一套深浅色，单一来源。
 */
export function getChartThemeColors() {
  const root = typeof document !== 'undefined' ? document.documentElement : null
  const read = (name, fallback) =>
    (root && getComputedStyle(root).getPropertyValue(name).trim()) || fallback
  return {
    axisText: read('--text-secondary', '#6b7280'),
    axisLine: read('--border', '#e8eaf0'),
    splitLine: read('--border', '#eceef2'),
    tooltipBg: read('--surface', '#ffffff'),
    tooltipBorder: read('--border', '#e8eaf0'),
    tooltipText: read('--text', '#1f2430')
  }
}

/** 跟随主题的 tooltip 配置，可叠加业务自定义的 formatter 等 */
export function chartTooltip(extra = {}) {
  const c = getChartThemeColors()
  return {
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    textStyle: { color: c.tooltipText },
    ...extra
  }
}
