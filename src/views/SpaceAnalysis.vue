<template>
  <div class="page analysis-page">
    <div class="page-head head-row">
      <div>
        <h1 class="page-title">数据分析</h1>
        <p class="page-subtitle">
          分类分布、标签热点、图片体积与上传趋势，一页看全。
          <template v-if="isAdmin">管理员还可以分析公共图库与全站空间。</template>
        </p>
      </div>
      <a-space>
        <a-button @click="router.push('/space')">返回我的空间</a-button>
        <a-button type="primary" :loading="loading" @click="loadAll">刷新数据</a-button>
      </a-space>
    </div>

    <!-- 范围与指标 -->
    <section class="toolbar surface-card">
      <div class="toolbar-item">
        <span class="toolbar-label">分析范围</span>
        <a-select
          v-model:value="scope"
          :options="scopeOptions"
          :disabled="!scopeOptions.length"
          placeholder="请选择分析范围"
          class="scope-select"
          @change="loadAll"
        >
          <template #suffixIcon><DatabaseOutlined /></template>
        </a-select>
      </div>
      <div class="toolbar-item">
        <span class="toolbar-label">统计指标</span>
        <a-radio-group
          v-model:value="metric"
          :options="ANALYSIS_METRIC_OPTIONS"
          option-type="button"
          button-style="solid"
          size="small"
        />
      </div>
      <p v-if="!scopeOptions.length" class="scope-tip">
        你还没有可分析的空间，先去「我的空间」创建一个再来查看。
      </p>
    </section>

    <!-- 概览数字 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-icon" style="background: #eef0ff; color: #4f46e5"><PictureOutlined /></div>
        <div class="stat-meta">
          <span class="stat-label">图片总数</span>
          <span class="stat-value">{{ totalCount }}<i>张</i></span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #e6f7f1; color: #10b981"><FolderOpenOutlined /></div>
        <div class="stat-meta">
          <span class="stat-label">占用空间</span>
          <span class="stat-value">{{ compactSize(totalSize) }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #fff4e6; color: #f59e0b"><AppstoreOutlined /></div>
        <div class="stat-meta">
          <span class="stat-label">分类数</span>
          <span class="stat-value">{{ categories.length }}<i>个</i></span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #fdeef5; color: #ec4899"><TagsOutlined /></div>
        <div class="stat-meta">
          <span class="stat-label">标签数</span>
          <span class="stat-value">{{ tags.length }}<i>个</i></span>
        </div>
      </div>
    </div>

    <a-spin :spinning="loading">
      <!-- 分类：分组条形图（数量 + 大小两组系列、两个值轴） -->
      <section class="surface-card chart-card">
        <div class="chart-head">
          <h2 class="chart-title"><span class="title-bar" />分类分析</h2>
          <p class="chart-desc">各分类的图片数量与占用空间对比（展示 {{ metricLabel }}最多的前 10 个分类）</p>
        </div>
        <EChart v-if="categoryOption" :option="categoryOption" :height="360" />
        <a-empty v-else description="该范围内还没有分类数据" />
      </section>

      <div class="chart-grid">
        <!-- 标签：词云 -->
        <section class="surface-card chart-card">
          <div class="chart-head">
            <h2 class="chart-title"><span class="title-bar pink" />标签分析</h2>
            <p class="chart-desc">字号越大代表{{ metricLabel }}越多，突出常用标签</p>
          </div>
          <EChart v-if="tagOption" :option="tagOption" :height="330" />
          <a-empty v-else description="该范围内还没有标签数据" />
        </section>

        <!-- 大小分段：饼图 -->
        <section class="surface-card chart-card">
          <div class="chart-head">
            <h2 class="chart-title"><span class="title-bar amber" />图片大小分析</h2>
            <p class="chart-desc">按体积分段统计，5MB 以上的图片建议压缩后再上传</p>
          </div>
          <EChart v-if="sizeOption" :option="sizeOption" :height="330" />
          <a-empty v-else description="该范围内还没有图片" />
        </section>
      </div>

      <!-- 上传趋势：折线图，时间范围在本卡片内切换 -->
      <section class="surface-card chart-card">
        <div class="chart-head chart-head-row">
          <div>
            <h2 class="chart-title"><span class="title-bar teal" />上传行为分析</h2>
            <p class="chart-desc">{{ trendRangeDesc }}，点击折线上的点可查看各人上传数量</p>
          </div>
          <a-radio-group
            v-model:value="trendTimeRange"
            :options="TREND_TIME_RANGE_OPTIONS"
            option-type="button"
            button-style="solid"
            size="small"
            @change="loadTrend"
          />
        </div>
        <a-spin :spinning="trendLoading">
          <EChart v-if="trendOption" :option="trendOption" :height="320" @click="onTrendClick" />
          <a-empty v-else :description="`${trendRangeLabel}还没有上传记录`" />
          <div v-if="trendDetail" class="trend-detail">
            <div class="trend-detail-head">
              <span class="trend-detail-title">{{ trendDetail.full }} 上传明细</span>
              <span class="trend-detail-total">共 {{ trendDetail.value }} 张</span>
              <a class="trend-detail-close" @click="trendDetail = null">收起</a>
            </div>
            <ul v-if="trendDetail.users.length" class="trend-user-list">
              <li v-for="user in trendDetail.users" :key="user.userName">
                <span class="trend-user-name">{{ user.userName }}</span>
                <span class="trend-user-bar">
                  <i :style="{ width: ratioOf(user.pictureCount, trendDetail.value) }" />
                </span>
                <span class="trend-user-count">{{ user.pictureCount }} 张</span>
              </li>
            </ul>
            <p v-else class="trend-detail-empty">这个时间点还没有人上传图片</p>
          </div>
        </a-spin>
      </section>
    </a-spin>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AppstoreOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  TagsOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { analysisCategory, analysisSize, analysisTag, analysisTrend } from '@/api/analysis'
import { queryMySpaceList, querySpaceById } from '@/api/space'
import EChart from '@/components/EChart.vue'
import {
  ANALYSIS_METRIC,
  ANALYSIS_METRIC_OPTIONS,
  ANALYSIS_SCOPE,
  SPACE_TYPE,
  TREND_TIME_RANGE,
  TREND_TIME_RANGE_OPTIONS
} from '@/constants'
import { useSpaceStore } from '@/stores/space'
import { useUserStore } from '@/stores/user'
import { formatSize } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const spaceStore = useSpaceStore()

/** 全站图表统一配色 */
const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1']

const isAdmin = computed(() => userStore.isAdmin)

const loading = ref(false)
const categories = ref([])
const tags = ref([])
const sizeRanges = ref([])
const trendList = ref([])
const trendLoading = ref(false)
/** 点击折线后展开的某一天（或某个月）的上传明细 */
const trendDetail = ref(null)
const metric = ref(ANALYSIS_METRIC.COUNT)
/** 时间范围只影响上传行为分析，分类 / 标签 / 大小分析一律统计全量 */
const trendTimeRange = ref(TREND_TIME_RANGE.WEEK)
/** 当前选择的分析范围：'space:{id}' 或 ANALYSIS_SCOPE.PUBLIC_SPACE / ALL_SPACE */
const scope = ref('')
/** 可分析的空间：个人空间 + 我加入的团队空间 */
const mySpaces = ref([])

const metricLabel = computed(
  () => ANALYSIS_METRIC_OPTIONS.find((item) => item.value === metric.value)?.label || '图片数量'
)

const trendRangeLabel = computed(
  () => TREND_TIME_RANGE_OPTIONS.find((item) => item.value === trendTimeRange.value)?.label || '本周'
)

const trendRangeDesc = computed(
  () =>
    ({
      [TREND_TIME_RANGE.WEEK]: '按天统计本周一至周日',
      [TREND_TIME_RANGE.MONTH]: '按天统计本月每一天',
      [TREND_TIME_RANGE.YEAR]: '按月统计本年 1 至 12 月'
    })[trendTimeRange.value] || '按天统计'
)

const scopeOptions = computed(() => {
  const options = mySpaces.value.map((item) => ({
    value: `space:${item.id}`,
    label: item.spaceType === SPACE_TYPE.TEAM ? `团队空间 · ${item.spaceName}` : `个人空间 · ${item.spaceName}`
  }))
  if (isAdmin.value) {
    options.push(
      { value: ANALYSIS_SCOPE.PUBLIC_SPACE, label: '公共图库（全站）' },
      { value: ANALYSIS_SCOPE.ALL_SPACE, label: '所有用户空间（全站）' }
    )
  }
  return options
})

/** 把界面上的范围选择翻译成后端入参 */
const requestPayload = computed(() => {
  const value = scope.value
  if (value === ANALYSIS_SCOPE.PUBLIC_SPACE || value === ANALYSIS_SCOPE.ALL_SPACE) {
    return { scope: value }
  }
  const spaceId = value.startsWith('space:') ? value.slice(6) : value
  return { scope: ANALYSIS_SCOPE.SINGLE_SPACE, spaceId }
})

const totalCount = computed(() =>
  categories.value.reduce((sum, item) => sum + Number(item.pictureCount || 0), 0)
)
const totalSize = computed(() =>
  categories.value.reduce((sum, item) => sum + Number(item.totalSize || 0), 0)
)

/** 大数不显示一堆小数：MB 级以上用紧凑格式 */
function compactSize(bytes) {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) {
    const gb = mb / 1024
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(1)} MB`
  }
  return formatSize(bytes, 0)
}

/** 按当前指标从大到小排 */
function sortByMetric(list) {
  return [...list].sort((a, b) => Number(b[metric.value] || 0) - Number(a[metric.value] || 0))
}

/* 分类分析：横向分组条形图，数量与空间两组系列、两个值轴 */
const categoryOption = computed(() => {
  const list = sortByMetric(categories.value).slice(0, 10)
  if (!list.length) return null
  const rows = [...list].reverse()
  return {
    legend: { top: 0, itemWidth: 12, itemHeight: 8, itemGap: 20 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const index = params[0].dataIndex
        const item = rows[index]
        return [
          `<b>${item.categoryName || '未分类'}</b>`,
          `图片数量：${item.pictureCount ?? 0} 张`,
          `占用空间：${formatSize(item.totalSize)}`
        ].join('<br/>')
      }
    },
    grid: { left: 8, right: 30, top: 34, bottom: 8, containLabel: true },
    xAxis: [
      {
        // 轴名留给图例表达，避免轴名在图边缘被截断
        type: 'value',
        splitLine: { show: false },
        axisLabel: { color: '#6b7280' }
      },
      {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#eceef2' } },
        axisLabel: {
          color: '#6b7280',
          formatter: (value) => (value >= 1024 * 1024 ? `${Math.round(value / (1024 * 1024))}G` : `${Math.round(value / 1024)}M`)
        }
      }
    ],
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.categoryName || '未分类'),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e8eaf0' } },
      axisLabel: { color: '#374151', width: 96, overflow: 'truncate' }
    },
    series: [
      {
        name: '图片数量',
        type: 'bar',
        xAxisIndex: 0,
        barWidth: 10,
        itemStyle: { color: '#4f46e5', borderRadius: [0, 5, 5, 0] },
        data: rows.map((item) => Number(item.pictureCount || 0))
      },
      {
        name: '占用空间',
        type: 'bar',
        xAxisIndex: 1,
        barWidth: 10,
        itemStyle: { color: '#0ea5e9', borderRadius: [0, 5, 5, 0] },
        data: rows.map((item) => Number(item.totalSize || 0))
      }
    ]
  }
})

/* 标签分析：词云 */
const tagOption = computed(() => {
  const list = sortByMetric(tags.value).slice(0, 60)
  if (!list.length) return null
  return {
    tooltip: {
      formatter: (params) => {
        const item = list.find((tag) => (tag.tagName || '未命名') === params.name)
        return `<b>${params.name}</b><br/>图片数量：${item?.pictureCount ?? 0} 张<br/>占用空间：${formatSize(item?.totalSize || 0)}`
      }
    },
    series: [
      {
        type: 'wordCloud',
        shape: 'circle',
        width: '94%',
        height: '90%',
        sizeRange: [13, 46],
        rotationRange: [0, 0],
        gridSize: 6,
        drawOutOfBound: false,
        layoutAnimation: true,
        textStyle: {
          fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
          fontWeight: 600,
          color: () => PALETTE[Math.floor(Math.random() * PALETTE.length)]
        },
        emphasis: { textStyle: { shadowBlur: 8, shadowColor: 'rgba(79, 70, 229, 0.35)' } },
        data: list.map((item) => ({
          name: item.tagName || '未命名',
          value: Number(item[metric.value] || 0)
        }))
      }
    ]
  }
})

/*
 * 大小分段：饼图。区间与后端 SIZE_SEGMENT_KEYS 一一对应，顺序即扇区顺序。
 * 体积越大颜色越暖，一眼能看出「有多少图该压一压」
 */
const SIZE_SEGMENTS = [
  { key: 'LT_100KB', label: '小于 100KB', color: '#10b981' },
  { key: '100KB_500KB', label: '100KB ~ 500KB', color: '#84cc16' },
  { key: '500KB_2MB', label: '500KB ~ 2MB', color: '#f59e0b' },
  { key: '2MB_5MB', label: '2MB ~ 5MB', color: '#f97316' },
  { key: 'GTE_5MB', label: '5MB 及以上', color: '#ef4444' }
]

const sizeOption = computed(() => {
  if (!sizeRanges.value.length) return null
  const data = SIZE_SEGMENTS.map((segment) => {
    const hit = sizeRanges.value.find((item) => item.sizeRange === segment.key)
    return {
      name: segment.label,
      value: Number(hit?.pictureCount || 0),
      itemStyle: { color: segment.color },
      totalSize: Number(hit?.totalSize || 0)
    }
  })
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) =>
        `${params.name}<br/>${params.value} 张（${params.percent}%）<br/>合计 ${formatSize(params.data.totalSize)}`
    },
    /*
     * 扇区上不写字：5 段时外部标签必然压到饼图上或互相重叠。
     * 名称与占比全部交给底部图例，hover 看详细体积
     */
    legend: {
      bottom: 0,
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
      formatter: (name) => {
        const hit = data.find((item) => item.name === name)
        const percent = total ? Math.round((hit.value / total) * 100) : 0
        return `${name}  ${percent}%`
      }
    },
    series: [
      {
        type: 'pie',
        // 半径收一点，给底部图例留出空间，避免整张图被挤到卡片上沿
        radius: ['42%', '64%'],
        center: ['50%', '40%'],
        minAngle: 4,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scaleSize: 6 },
        data
      }
    ]
  }
})

/*
 * 上传趋势：横轴由时间范围决定（本周 7 天 / 本月每一天 / 本年 12 个月）。
 * 后端只返回有数据的点，这里按轴补齐 0，保证「没有上传的那天」也画在图上
 */
function buildTrendAxis(range) {
  const now = dayjs()
  const pad = (value) => String(value).padStart(2, '0')
  if (range === TREND_TIME_RANGE.YEAR) {
    const year = now.year()
    return Array.from({ length: 12 }).map((_, index) => {
      const month = index + 1
      return { key: `${year}-${pad(month)}`, label: `${month}月`, full: `${year} 年 ${month} 月` }
    })
  }
  if (range === TREND_TIME_RANGE.MONTH) {
    const month = now.format('YYYY-MM')
    return Array.from({ length: now.daysInMonth() }).map((_, index) => {
      const day = index + 1
      return { key: `${month}-${pad(day)}`, label: `${day}`, full: `${month}-${pad(day)}` }
    })
  }
  // 周一为一周起点：dayjs 的 day() 周日是 0，换算成「距周一的天数」
  const monday = now.subtract((now.day() + 6) % 7, 'day')
  return Array.from({ length: 7 }).map((_, index) => {
    const date = monday.add(index, 'day')
    return { key: date.format('YYYY-MM-DD'), label: date.format('MM-DD'), full: date.format('YYYY-MM-DD') }
  })
}

const trendPoints = computed(() => {
  const axis = buildTrendAxis(trendTimeRange.value)
  const map = new Map(trendList.value.map((item) => [item.statDate, item]))
  return axis.map((point) => {
    const hit = map.get(point.key)
    return {
      ...point,
      value: Number(hit?.pictureCount || 0),
      users: Array.isArray(hit?.userStats) ? hit.userStats : []
    }
  })
})

const trendTotal = computed(() => trendPoints.value.reduce((sum, item) => sum + item.value, 0))

function onTrendClick({ axisValue } = {}) {
  // axisValue 是点击位置换算出的类目下标，可能是小数，四舍五入后夹在合法范围内
  const index = Math.round(Number(axisValue))
  if (!Number.isFinite(index) || index < 0 || index >= trendPoints.value.length) return
  const point = trendPoints.value[index]
  if (!point) return
  // 再点同一个点就收起
  trendDetail.value = trendDetail.value?.key === point.key ? null : point
}

function ratioOf(count, total) {
  if (!total) return '0%'
  return `${Math.max(4, Math.round((Number(count) / total) * 100))}%`
}

const trendOption = computed(() => {
  const points = trendPoints.value
  if (!points.length || !trendTotal.value) return null
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#4f46e5' } },
      formatter: (params) => {
        const point = params[0]?.data?.key ? params[0].data : points[params[0]?.dataIndex]
        if (!point) return ''
        return [`${point.full}`, `上传 ${point.value} 张`, '点击查看各人明细'].join('<br/>')
      }
    },
    grid: { left: 8, right: 20, top: 30, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e8eaf0' } },
      axisLabel: { color: '#6b7280', rotate: points.length > 15 ? 36 : 0 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { type: 'dashed', color: '#eceef2' } },
      axisLabel: { color: '#6b7280' }
    },
    series: [
      {
        name: '上传数量',
        type: 'line',
        smooth: true,
        // triggerLineEvent：默认只有点中圆点才触发 click，开了之后点折线任意位置都能选中那一天
        triggerLineEvent: true,
        symbolSize: 8,
        // 用对象形式带完整信息：点击回调里靠 data 找回是哪一天，不依赖 dataIndex
        data: points.map((item) => ({ ...item, name: item.label })),
        lineStyle: { width: 3, color: '#4f46e5' },
        itemStyle: { color: '#4f46e5' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79, 70, 229, 0.22)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0.02)' }
            ]
          }
        }
      }
    ]
  }
})

async function loadMySpaces() {
  const [personal, teams] = await Promise.all([
    querySpaceById('', SPACE_TYPE.PERSONAL, { silent: true }).catch(() => null),
    queryMySpaceList({ silent: true }).catch(() => [])
  ])
  const list = []
  if (personal?.id) list.push(personal)
  list.push(...(Array.isArray(teams) ? teams : []))
  mySpaces.value = list
}

/** 默认范围：URL 带 spaceId 用之，否则个人空间，再不然第一个团队空间 */
function pickDefaultScope() {
  const fromQuery = route.query.spaceId ? String(route.query.spaceId) : ''
  if (fromQuery && (mySpaces.value.some((item) => item.id === fromQuery) || isAdmin.value)) {
    return `space:${fromQuery}`
  }
  const personal = mySpaces.value.find((item) => item.spaceType === SPACE_TYPE.PERSONAL)
  if (personal) return `space:${personal.id}`
  return mySpaces.value.length ? `space:${mySpaces.value[0].id}` : ''
}

/** 上传行为分析单独请求：只有它带时间范围，切换范围时不必重拉全量分析 */
async function loadTrend() {
  if (!scope.value) {
    trendList.value = []
    trendDetail.value = null
    return
  }
  trendLoading.value = true
  // 之前展开的明细属于旧时间范围，直接收起
  trendDetail.value = null
  try {
    const list = await analysisTrend({
      ...requestPayload.value,
      timeRange: trendTimeRange.value
    }).catch(() => [])
    trendList.value = Array.isArray(list) ? list : []
  } finally {
    trendLoading.value = false
  }
}

async function loadAll() {
  if (!scope.value) {
    categories.value = []
    tags.value = []
    sizeRanges.value = []
    trendList.value = []
    return
  }
  loading.value = true
  // 分类 / 标签 / 大小分析统计建库以来的全量数据，不带任何时间参数
  const payload = { ...requestPayload.value }
  try {
    const [categoryList, tagList, sizeList] = await Promise.all([
      analysisCategory(payload).catch(() => []),
      analysisTag(payload).catch(() => []),
      analysisSize(payload).catch(() => [])
    ])
    categories.value = Array.isArray(categoryList) ? categoryList : []
    tags.value = Array.isArray(tagList) ? tagList : []
    sizeRanges.value = Array.isArray(sizeList) ? sizeList : []
    await loadTrend()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadMySpaces()
  // 空间 store 可能已经在别的页面加载过，顺手用它的团队列表补一次，避免漏
  if (spaceStore.teams?.length) {
    const known = new Set(mySpaces.value.map((item) => item.id))
    spaceStore.teams.forEach((item) => {
      if (!known.has(item.id)) mySpaces.value.push(item)
    })
  }
  scope.value = pickDefaultScope()
  await loadAll()
})
</script>

<style scoped lang="less">
.analysis-page {
  max-width: 1280px;
}

.head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

/* ---- 工具条 ---- */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 28px;
  padding: 14px 18px;
  margin-bottom: 16px;
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.scope-select {
  min-width: 230px;
}

.scope-tip {
  flex-basis: 100%;
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* ---- 概览数字 ---- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  font-size: 20px;
  flex-shrink: 0;
}

.stat-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);

  i {
    margin-left: 4px;
    font-style: normal;
    font-size: 12px;
    font-weight: 400;
    color: var(--text-tertiary);
  }
}

/* ---- 图表卡片 ---- */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.chart-card {
  padding: 18px 20px 14px;
  min-width: 0;
  margin-bottom: 16px;
}

.chart-grid .chart-card {
  margin-bottom: 0;
}

.chart-head {
  margin-bottom: 6px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.title-bar {
  width: 4px;
  height: 14px;
  border-radius: 2px;
  background: #4f46e5;

  &.pink {
    background: #ec4899;
  }

  &.amber {
    background: #f59e0b;
  }

  &.teal {
    background: #14b8a6;
  }
}

.chart-desc {
  margin: 4px 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 上传行为分析的卡片头：标题在左、时间范围切换在右（其它卡片没有右侧控件，保持常规块级排布） */
.chart-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

/* ---- 点击折线后的某一天上传明细 ---- */
.trend-detail {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-subtle, rgba(79, 70, 229, 0.03));
}

.trend-detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
}

.trend-detail-title {
  font-weight: 600;
  color: var(--text);
}

.trend-detail-total {
  color: var(--text-secondary);
}

.trend-detail-close {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-tertiary);
}

.trend-user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.trend-user-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.trend-user-name {
  width: 96px;
  flex-shrink: 0;
  color: var(--text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.trend-user-bar {
  flex: 1;
  height: 8px;
  min-width: 0;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: #4f46e5;
  }
}

.trend-user-count {
  width: 56px;
  flex-shrink: 0;
  text-align: right;
  color: var(--text-secondary);
}

.trend-detail-empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 1100px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
