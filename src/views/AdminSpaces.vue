<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">空间管理</h1>
      <p class="page-subtitle">
        查看与管理全站用户的私有空间。可按空间名称、空间版本筛选；点「查看」可看单个空间详情，
        删除空间会一并移除其下图片。
      </p>
    </div>

    <section class="filter-bar surface-card">
      <div class="filter-fields">
        <a-input
          v-model:value="query.spaceName"
          placeholder="按空间名称搜索"
          allow-clear
          style="width: 200px"
          @press-enter="onSearch"
        />
        <a-select
          v-model:value="query.spaceType"
          placeholder="空间类型"
          :options="SPACE_TYPE_OPTIONS"
          allow-clear
          style="width: 130px"
          @change="onSearch"
        />
        <a-select
          v-model:value="query.spaceLevel"
          placeholder="空间版本"
          :options="SPACE_LEVEL_OPTIONS"
          allow-clear
          style="width: 140px"
          @change="onSearch"
        />
        <a-button type="primary" @click="onSearch">查询</a-button>
        <a-button type="link" @click="resetFilter">重置</a-button>
      </div>
    </section>

    <div class="surface-card table-card">
      <a-table
        :columns="columns"
        :data-source="spaces"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 1140 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'spaceName'">
            <div class="name-cell">{{ record.spaceName || '未命名空间' }}</div>
          </template>

          <template v-else-if="column.key === 'owner'">
            <div class="name-cell">{{ record.userName || '用户已注销' }}</div>
          </template>

          <template v-else-if="column.key === 'spaceType'">
            <a-tag :color="spaceTypeMeta(record.spaceType).color">
              {{ spaceTypeMeta(record.spaceType).label }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'spaceLevel'">
            <a-tag :color="spaceLevelMeta(record.spaceLevel).color">
              {{ spaceLevelMeta(record.spaceLevel).label }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'usage'">
            <div class="usage-bar">
              <a-progress
                :percent="usedPercent(record)"
                :size="[120, 8]"
                :show-info="false"
                :stroke-color="usageColor(record)"
              />
              <span class="usage-text">
                {{ formatSize(record.totalSize) }} / {{ formatSize(record.maxSize) }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'totalCount'">
            {{ record.totalCount ?? 0 }} 张
          </template>

          <template v-else-if="column.key === 'createTime'">
            {{ formatTime(record.createTime) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="openDetail(record)">查看</a-button>
              <a-popconfirm
                title="确认删除该空间？"
                description="空间下所有图片也会被删除，且不可恢复。"
                ok-text="删除"
                cancel-text="取消"
                :ok-button-props="{ danger: true }"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 空间详情抽屉 -->
    <a-drawer
      v-model:open="detailOpen"
      :title="detail?.spaceName || '空间详情'"
      width="420"
      :footer="null"
    >
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detail" :column="1" bordered size="small">
          <a-descriptions-item label="空间名称">{{ detail.spaceName || '未命名空间' }}</a-descriptions-item>
          <a-descriptions-item label="空间类型">
            <a-tag :color="spaceTypeMeta(detail.spaceType).color">
              {{ spaceTypeMeta(detail.spaceType).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="空间版本">
            <a-tag :color="spaceLevelMeta(detail.spaceLevel).color">
              {{ spaceLevelMeta(detail.spaceLevel).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="所有者">
            {{ detail.userName || '用户已注销' }}
          </a-descriptions-item>
          <a-descriptions-item label="总容量">{{ formatSize(detail.maxSize, 3) }}</a-descriptions-item>
          <a-descriptions-item label="已用容量">{{ formatSize(detail.totalSize, 3) }}</a-descriptions-item>
          <a-descriptions-item label="剩余容量">{{ formatSize(freeSizeOf(detail), 3) }}</a-descriptions-item>
          <a-descriptions-item label="图片数量">{{ detail.totalCount ?? 0 }} 张</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatTime(detail.createTime) }}</a-descriptions-item>
          <a-descriptions-item label="编辑时间">{{ formatTime(detail.editTime) }}</a-descriptions-item>
        </a-descriptions>
        <a-empty v-else description="暂无数据" />
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { deleteSpace, querySpaceById, querySpaceList } from '@/api/space'
import { PAGE_SIZE_OPTIONS, SPACE_LEVEL_OPTIONS, SPACE_TYPE_OPTIONS } from '@/constants'
import { formatSize, formatTime, spaceLevelMeta, spaceTypeMeta } from '@/utils/format'

const spaces = ref([])
const total = ref(0)
const loading = ref(false)

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref(null)
const detailId = ref(null)

const query = reactive({
  spaceName: '',
  spaceType: undefined,
  spaceLevel: undefined,
  pageNum: 1,
  pageSize: 20,
  sortField: 'createTime',
  sortOrder: 'descend'
})

const columns = [
  { title: '空间名称', key: 'spaceName', width: 180 },
  { title: '类型', key: 'spaceType', width: 100 },
  { title: '所有者', key: 'owner', width: 150 },
  { title: '版本', key: 'spaceLevel', width: 100 },
  { title: '已用 / 总容量', key: 'usage', width: 220 },
  { title: '图片数', key: 'totalCount', width: 90 },
  { title: '创建时间', key: 'createTime', width: 170 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' }
]

const pagination = computed(() => ({
  current: query.pageNum,
  pageSize: query.pageSize,
  total: total.value,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showSizeChanger: true,
  showTotal: (t) => `共 ${t} 个空间`
}))

function usedPercent(record) {
  const max = Number(record?.maxSize || 0)
  const used = Number(record?.totalSize || 0)
  if (max <= 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

function usageColor(record) {
  const p = usedPercent(record)
  if (p >= 90) return '#e5484d'
  if (p >= 70) return '#f5a524'
  return '#4f46e5'
}

function freeSizeOf(record) {
  const max = Number(record?.maxSize || 0)
  const used = Number(record?.totalSize || 0)
  return Math.max(0, max - used)
}

function buildParams() {
  return {
    spaceName: query.spaceName || undefined,
    spaceType: query.spaceType ?? undefined,
    spaceLevel: query.spaceLevel ?? undefined,
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    sortField: query.sortField,
    sortOrder: query.sortOrder
  }
}

async function fetchList() {
  loading.value = true
  try {
    const page = await querySpaceList(buildParams())
    spaces.value = page?.records || []
    total.value = Number(page?.total || 0)
  } catch (e) {
    spaces.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.pageNum = 1
  fetchList()
}

function resetFilter() {
  query.spaceName = ''
  query.spaceType = undefined
  query.spaceLevel = undefined
  query.pageNum = 1
  fetchList()
}

function handleTableChange(pager) {
  query.pageNum = pager.current
  query.pageSize = pager.pageSize
  fetchList()
}

function openDetail(record) {
  detailId.value = record.id
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  querySpaceById(record.id)
    .then((res) => {
      detail.value = res
    })
    .catch(() => {
      message.error('获取空间详情失败')
    })
    .finally(() => {
      detailLoading.value = false
    })
}

async function handleDelete(record) {
  try {
    await deleteSpace(record.id)
    message.success('空间已删除')
    fetchList()
  } catch (e) {
    /* 拦截器已提示 */
  }
}

onMounted(fetchList)
</script>

<style scoped lang="less">
.filter-bar {
  padding: 16px 18px;
  margin-bottom: 16px;
}

.filter-fields {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.table-card {
  padding: 6px 8px 2px;
}

.name-cell {
  font-weight: 550;
  color: var(--text);
}

.cell-sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.usage-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.usage-text {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
