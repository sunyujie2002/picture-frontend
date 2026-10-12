<template>
  <div ref="holder" class="echart-box" :style="{ height: `${height}px` }" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
// 按需引入：全量 echarts 会把包体撑大一截，这里只注册用到的图表与组件
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
// 词云是独立扩展包，import 即完成注册
import 'echarts-wordcloud'

import { useThemeStore } from '@/stores/theme'
import { getChartThemeColors } from '@/utils/chartTheme'

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  /** ECharts option；传 null / undefined 时清空画布（如空数据） */
  option: { type: Object, default: null },
  /** 图表高度（px），宽度跟随父容器 */
  height: { type: Number, default: 320 }
})

const emit = defineEmits(['click'])

/** convertFromPixel 的坐标系查找方式，按可靠性排序（grid 覆盖直角坐标系，series 兜底） */
const TRY_FINDERS = [{ gridIndex: 0 }, { xAxisIndex: 0 }, { seriesIndex: 0 }]

const holder = ref()
let chart = null
let observer = null

/**
 * 把主题色（轴文字 / 轴线条 / 分割线 / tooltip）注入到 option，跟随深浅模式。
 * 纯函数式：只生成新的子对象，绝不修改传入的 option，避免触发父级 option 的 deep watch 死循环。
 */
function themeChart(opt, c) {
  if (Array.isArray(opt)) return opt.map((item) => themeChart(item, c))
  if (opt && typeof opt === 'object') {
    const out = {}
    for (const key in opt) {
      if (key === 'axisLabel' && opt.axisLabel && typeof opt.axisLabel === 'object') {
        out.axisLabel = { ...opt.axisLabel, color: c.axisText }
      } else if (key === 'axisLine' && opt.axisLine && typeof opt.axisLine === 'object') {
        out.axisLine = { ...opt.axisLine, lineStyle: { ...(opt.axisLine.lineStyle || {}), color: c.axisLine } }
      } else if (key === 'splitLine' && opt.splitLine && typeof opt.splitLine === 'object') {
        out.splitLine = {
          ...opt.splitLine,
          lineStyle: { ...(opt.splitLine.lineStyle || {}), color: c.splitLine, type: 'dashed' }
        }
      } else if (key === 'legend' && opt.legend && typeof opt.legend === 'object') {
        out.legend = { ...opt.legend, textStyle: { ...(opt.legend.textStyle || {}), color: c.axisText } }
      } else if (key === 'textStyle' && opt.textStyle && typeof opt.textStyle === 'object') {
        out.textStyle = { ...opt.textStyle, color: c.axisText }
      } else if (key === 'tooltip' && opt.tooltip && typeof opt.tooltip === 'object') {
        out.tooltip = {
          ...opt.tooltip,
          backgroundColor: c.tooltipBg,
          borderColor: c.tooltipBorder,
          textStyle: { ...(opt.tooltip.textStyle || {}), color: c.tooltipText }
        }
      } else {
        out[key] = themeChart(opt[key], c)
      }
    }
    return out
  }
  return opt
}

function render(option) {
  if (!chart) return
  if (!option) {
    chart.clear()
    return
  }
  // notMerge = true：切换指标 / 数据源时不会残留上一次的 series
  // 注入主题色，让坐标轴 / 文字 / tooltip 跟随深浅模式（从 CSS 变量读取，与全站统一）
  const themed = themeChart(option, getChartThemeColors())
  chart.setOption(themed, true)
  chart.resize()
}

const themeStore = useThemeStore()
// 主题切换后，画布用新的配色重新渲染（容器高度等不变，仅颜色刷新）
watch(
  () => themeStore.mode,
  () => render(props.option)
)

onMounted(() => {
  chart = echarts.init(holder.value)
  // 点击回调绑在实例上，setOption(notMerge) 不会把它冲掉，所以只绑一次
  /*
   * 用 zrender 的 click 而不是 series click：
   * - series click 只有点中圆点才带 dataIndex，点线身上是 undefined
   * - zr click 在画布内任意位置都会触发，配合 convertFromPixel 换算成类目下标，
   *   用户点「那一天附近的区域」就能选中那一天，容错好得多
   */
  chart.getZr().on('click', (event) => {
    const pixel = [event?.offsetX, event?.offsetY]
    // 不同图表的坐标系 finder 不一样，逐个试，取第一个能换算的
    const candidates = TRY_FINDERS.map((finder) => {
      try {
        return chart.convertFromPixel(finder, pixel)
      } catch {
        return null
      }
    })
    // 直角坐标系返回 [x 轴值, y 轴值]，类目轴上的 x 就是下标；饼图之类没有坐标系时返回 null
    const raw = candidates.find((item) => item !== null && item !== undefined) ?? null
    const axisValue = Array.isArray(raw) ? raw[0] : raw
    emit('click', { axisValue, pixel: { x: event?.offsetX, y: event?.offsetY } })
  })
  render(props.option)
  // 侧栏折叠、窗口缩放后画布尺寸会变，交给 ResizeObserver 统一兜住
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(holder.value)
})

watch(() => props.option, render, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.echart-box {
  width: 100%;
}
</style>
