<template>
  <div class="page ranking-page">
    <div class="page-head head-row">
      <div>
        <h1 class="page-title">空间用量排行</h1>
        <p class="page-subtitle">
          按已用容量给全站空间排名，先看 Top 10；点「查看全部」可翻页查看完整榜单。仅管理员可见。
        </p>
      </div>
      <a-button type="primary" :loading="loading" @click="loadAll">刷新</a-button>
    </div>

    <!-- 全空间资源用量总览 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-icon" style="background: #eef0ff; color: #4f46e5"><UserOutlined /></div>
        <div class="stat-meta">
          <span class="stat-label">个人空间总用量</span>
          <span class="stat-value">{{ compactSize(sumSize(SPACE_TYPE.PERSONAL)) }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #e6f7f1; color: #10b981"><TeamOutlined /></div>
        <div class="stat-meta">
          <span class="stat-label">团队空间总用量</span>
          <span class="stat-value">{{ compactSize(sumSize(SPACE_TYPE.TEAM)) }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: #fff4e6; color: #f59e0b"><DatabaseOutlined /></div>
        <div class="stat-meta">
          <span class="stat-label">全站空间总用量</span>
          <span class="stat-value">{{ compactSize(sumSize()) }}</span>
        </div>
      </div>
    </div>

    <div class="chart-grid">
      <section v-for="board in boards" :key="board.spaceType" class="surface-card chart-card">
        <div class="chart-head with-action">
          <div>
            <h2 class="chart-title"><span class="title-bar" :class="board.barClass" />{{ board.title }}用量 Top 10</h2>
            <p class="chart-desc">共 {{ board.rowCount }} 个空间，按已用容量排序</p>
          </div>
          <a-button size="small" @click="openAll(board.spaceType)">查看全部</a-button>
        </div>
        <EChart v-if="board.option" :option="board.option" :height="360" />
        <a-empty v-else :description="`还没有${board.title}空间`" />
      </section>
    </div>

    <!-- 完整榜单 -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="`${currentBoard?.title || ''}空间用量排行（全部）`"
      width="860"
      :footer="null"
    >
      <a-table
        :columns="columns"
        :data-source="pagedRows"
        :pagination="pagination"
        row-key="spaceId"
        :scroll="{ x: 720 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'rank'">
            <span :class="['rank-tag', { top: record.rank <= 3 }]">{{ record.rank }}</span>
          </template>
          <template v-else-if="column.key === 'spaceName'">
            {{ record.spaceName || '未命名空间' }}
          </template>
          <template v-else-if="column.key === 'owner'">
            {{ record.userName || '用户已注销' }}
          </template>
          <template v-else-if="column.key === 'totalSize'">
            {{ formatSize(record.totalSize) }}
          </template>
          <template v-else-if="column.key === 'used'">
            <div class="usage-bar">
              <a-progress
                :percent="usagePercent(record)"
                :size="[110, 8]"
                :show-info="false"
                :stroke-color="usageColor(record)"
              />
              <span class="usage-text">{{ usagePercent(record) }}%</span>
            </div>
          </template>
          <template v-else-if="column.key === 'createTime'">
            {{ formatTime(record.createTime) }}
          </template>
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { DatabaseOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons-vue'
import { analysisSpaceUsage } from '@/api/analysis'
import EChart from '@/components/EChart.vue'
import { DEFAULT_PAGE, PAGE_SIZE_OPTIONS, SPACE_TYPE } from '@/constants'
import { formatSize, formatTime } from '@/utils/format'

const TOP_N = 10

const loading = ref(false)
/** 后端一次返回全部空间（已按已用容量倒序），前端按类型拆榜 */
const usageList = ref([])

const drawerOpen = ref(false)
const drawerType = ref(SPACE_TYPE.PERSONAL)

function usagePercent(record) {
  const max = Number(record?.maxSize || 0)
  if (max <= 0) return 0
  return Math.min(100, Math.round((Number(record?.totalSize || 0) / max) * 100))
}

function usageColor(record) {
  const percent = usagePercent(record)
  if (percent >= 90) return '#cf1322'
  if (percent >= 70) return '#faad14'
  return '#4f46e5'
}

function sumSize(spaceType) {
  return usageList.value
    .filter((item) => spaceType === undefined || item.spaceType === spaceType)
    .reduce((sum, item) => sum + Number(item.totalSize || 0), 0)
}

/** 大数不显示一堆小数：MB 级以上用紧凑格式 */
function compactSize(bytes) {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) {
    const gb = mb / 1024
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(1)} MB`
  }
  return formatSize(bytes, 0)
}

function buildOption(list) {
  if (!list.length) return null
  // 类目轴自下而上排，倒序后用量最大的在最上面
  const rows = [...list].reverse()
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const index = params[0].dataIndex
        const item = rows[index]
        return [
          `<b>${item.spaceName || '未命名空间'}</b>`,
          `使用者：${item.userName || '用户已注销'}`,
          `已用：${formatSize(item.totalSize)} / ${formatSize(item.maxSize)}`
        ].join('<br/>')
      }
    },
    grid: { left: 8, right: 70, top: 12, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { type: 'dashed', color: '#eceef2' } },
      axisLabel: { color: '#6b7280', formatter: (value) => formatSize(value, 0) }
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.spaceName || '未命名空间'),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e8eaf0' } },
      axisLabel: { color: '#374151', width: 110, overflow: 'truncate' }
    },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        itemStyle: { color: '#4f46e5', borderRadius: [0, 6, 6, 0] },
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          color: '#6b7280',
          formatter: (params) => formatSize(params.value, 1)
        },
        data: rows.map((item) => Number(item.totalSize || 0))
      }
    ]
  }
}

const boards = computed(() => {
  const personalRows = usageList.value.filter((item) => item.spaceType === SPACE_TYPE.PERSONAL)
  const teamRows = usageList.value.filter((item) => item.spaceType === SPACE_TYPE.TEAM)
  return [
    {
      spaceType: SPACE_TYPE.PERSONAL,
      title: '个人空间',
      barClass: '',
      rowCount: personalRows.length,
      rows: personalRows.slice(0, TOP_N),
      option: buildOption(personalRows.slice(0, TOP_N))
    },
    {
      spaceType: SPACE_TYPE.TEAM,
      title: '团队空间',
      barClass: 'teal',
      rowCount: teamRows.length,
      rows: teamRows.slice(0, TOP_N),
      option: buildOption(teamRows.slice(0, TOP_N))
    }
  ]
})

const currentBoard = computed(() => boards.value.find((item) => item.spaceType === drawerType.value))

/* 「查看全部」：数据已在手，前端分页即可 */
const pagination = reactive({
  current: DEFAULT_PAGE.pageNum,
  pageSize: DEFAULT_PAGE.pageSize,
  total: 0,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showTotal: (total) => `共 ${total} 个空间`
})

function handleTableChange(page) {
  pagination.current = page.current
  pagination.pageSize = page.pageSize
}

const pagedRows = computed(() => {
  const rows = usageList.value.filter((item) => item.spaceType === drawerType.value)
  pagination.total = rows.length
  const offset = (pagination.current - 1) * pagination.pageSize
  return rows.map((item, index) => ({ ...item, rank: index + 1 })).slice(offset, offset + pagination.pageSize)
})

function openAll(spaceType) {
  drawerType.value = spaceType
  pagination.current = DEFAULT_PAGE.pageNum
  drawerOpen.value = true
}

async function loadAll() {
  loading.value = true
  try {
    const list = await analysisSpaceUsage()
    usageList.value = Array.isArray(list) ? list : []
  } catch (e) {
    usageList.value = []
  } finally {
    loading.value = false
  }
}

const columns = [
  { title: '排名', key: 'rank', width: 70 },
  { title: '空间名称', key: 'spaceName', width: 200 },
  { title: '使用者', key: 'owner', width: 130 },
  { title: '已用容量', key: 'totalSize', width: 110 },
  { title: '容量上限', key: 'maxSize', width: 110 },
  { title: '使用率', key: 'used', width: 170 },
  { title: '创建时间', key: 'createTime', width: 160 }
]

loadAll()
</script>

<style scoped lang="less">
.head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.chart-card {
  padding: 18px 20px 14px;
  min-width: 0;
}

.chart-head {
  margin-bottom: 6px;

  &.with-action {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
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

  &.teal {
    background: #14b8a6;
  }
}

.chart-desc {
  margin: 4px 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.rank-tag {
  display: inline-block;
  min-width: 24px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 11px;
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 12px;

  &.top {
    background: #fff1f0;
    color: #cf1322;
    font-weight: 600;
  }
}

.usage-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.usage-text {
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 1100px) {
  .stat-row {
    grid-template-columns: 1fr;
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
