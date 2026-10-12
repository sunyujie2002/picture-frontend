<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">图片审核管理</h1>
      <p class="page-subtitle">审核上传到公共图库的图片，通过后才会出现在首页图库。</p>
      <div class="page-tip">
        <InfoCircleOutlined class="tip-icon" />
        <span>
          发现违规内容判为「不通过」即可下架，已通过的图片后续同样可以再次下架。
          管理员自己上传的图片无需审核，管理自己的图片请用「图片管理」。
        </span>
      </div>
    </div>

    <section class="filter-bar surface-card">
      <div class="filter-fields">
        <a-input
          v-model:value="query.picName"
          placeholder="按名称搜索"
          allow-clear
          style="width: 200px"
          @press-enter="onSearch"
        />
        <a-select
          v-model:value="query.reviewStatus"
          placeholder="审核状态"
          :options="REVIEW_STATUS_OPTIONS"
          allow-clear
          style="width: 140px"
          @change="onSearch"
        />
        <a-select
          v-model:value="query.categoryId"
          placeholder="分类"
          :options="categoryOptions"
          allow-clear
          show-search
          option-filter-prop="label"
          style="width: 150px"
          @change="onSearch"
        />
        <a-select
          v-model:value="query.picFormat"
          placeholder="格式"
          :options="PIC_FORMAT_OPTIONS"
          allow-clear
          style="width: 110px"
          @change="onSearch"
        />
        <ColorPicker v-model="query.picColor" @change="onSearch" />
        <div class="filter-actions">
          <a-button type="primary" @click="onSearch">查询</a-button>
          <a-button type="link" @click="resetFilter">重置</a-button>
        </div>
      </div>
    </section>

    <transition name="fade-slide">
      <section v-if="selectedIds.length" class="batch-bar">
        <span class="batch-count">已选择 {{ selectedIds.length }} 张图片</span>
        <a-space>
          <a-button size="small" type="primary" @click="openBatchReview">批量审核</a-button>
          <a-button size="small" type="link" @click="clearSelection">取消选择</a-button>
        </a-space>
      </section>
    </transition>

    <div class="surface-card table-card">
      <a-table
        :columns="columns"
        :data-source="pictures"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :row-selection="rowSelection"
        :scroll="{ x: 1280 }"
        :locale="{ emptyText: '没有符合筛选条件的图片' }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'thumb'">
            <img
              :src="displayUrl(record)"
              :alt="record.picName"
              class="cell-thumb"
              @click="goDetail(record)"
            />
          </template>

          <template v-else-if="column.key === 'picName'">
            <a class="name-link ellipsis-1" :title="record.picName" @click="goDetail(record)">
              {{ record.picName || '未命名图片' }}
            </a>
            <div class="cell-sub ellipsis-1">{{ record.introduction || '暂无简介' }}</div>
          </template>

          <template v-else-if="column.key === 'uploader'">
            <span class="uploader-name ellipsis-1">
              {{ record.userName || '未知用户' }}
            </span>
          </template>

          <template v-else-if="column.key === 'category'">
            <a-tag v-if="record.categoryId" class="taxonomy-tag">{{ dictStore.categoryName(record.categoryId) }}</a-tag>
            <span v-else class="text-tertiary">-</span>
          </template>

          <template v-else-if="column.key === 'tags'">
            <template v-if="record.tags && record.tags.length">
              <a-tag v-for="t in record.tags.slice(0, 3)" :key="t" class="taxonomy-tag">
                {{ dictStore.tagName(t) }}
              </a-tag>
              <a-tag v-if="record.tags.length > 3" class="taxonomy-tag">
                +{{ record.tags.length - 3 }}
              </a-tag>
            </template>
            <span v-else class="text-tertiary">-</span>
          </template>

          <template v-else-if="column.key === 'size'">
            <div>{{ record.picWidth }} × {{ record.picHeight }}</div>
            <div class="cell-sub">{{ formatSize(record.picSize) }}</div>
          </template>

          <template v-else-if="column.key === 'color'">
            <span class="color-cell">
              <span class="color-dot" :style="{ background: normalizeColor(record.picColor) || '#c9cdd8' }" />
              {{ normalizeColor(record.picColor) || '-' }}
            </span>
          </template>

          <template v-else-if="column.key === 'reviewStatus'">
            <a-tag :color="reviewMeta(record.reviewStatus).color">
              {{ reviewMeta(record.reviewStatus).label }}
            </a-tag>
            <div
              v-if="record.reviewStatus === REVIEW_STATUS.REJECT && record.reviewMessage"
              class="cell-sub ellipsis-1"
              :title="record.reviewMessage"
            >
              {{ record.reviewMessage }}
            </div>
          </template>

          <template v-else-if="column.key === 'createTime'">
            {{ formatTime(record.createTime) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button v-if="reviewable(record)" type="link" size="small" @click="openReview(record)">
              审核
            </a-button>
            <a-tooltip v-else title="已判为不通过，需作者修改后重新提交">
              <span class="action-hint">不可审核</span>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </div>

    <!--
      审核弹窗：这个页面只做审核（含批量审核）。
      不提供编辑 / 删除——违规内容一律通过「不通过」下架，已通过的也能再次判为不通过。
    -->
    <a-modal
      v-model:open="reviewOpen"
      :title="reviewTitle"
      ok-text="提交审核"
      cancel-text="取消"
      :confirm-loading="submitting"
      @ok="handleReviewSubmit"
    >
      <p class="review-target">
        审核对象：<strong>{{ reviewTargetNames }}</strong>
      </p>
      <a-alert v-if="reviewHint" :message="reviewHint" type="info" show-icon class="review-hint" />
      <a-form layout="vertical" :model="reviewForm">
        <a-form-item label="审核结果">
          <a-radio-group v-model:value="reviewForm.reviewStatus" button-style="solid">
            <a-radio-button :value="REVIEW_STATUS.PASS" :disabled="!canPass">通过</a-radio-button>
            <a-radio-button :value="REVIEW_STATUS.REJECT" :disabled="!canReject">不通过（下架）</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          label="审核意见"
          :required="reviewForm.reviewStatus === REVIEW_STATUS.REJECT"
        >
          <a-textarea
            v-model:value="reviewForm.reviewMessage"
            :rows="3"
            :maxlength="120"
            show-count
            :placeholder="
              reviewForm.reviewStatus === REVIEW_STATUS.REJECT
                ? '必填：说明不通过的原因，作者据此修改后重新提交'
                : '可选，会展示给作者'
            "
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { queryReviewPictureList, reviewPicture } from '@/api/picture'
import {
  PAGE_SIZE_OPTIONS,
  PIC_FORMAT_OPTIONS,
  REVIEW_STATUS,
  REVIEW_STATUS_OPTIONS,
  SORT_ORDER
} from '@/constants'
import { useDictStore } from '@/stores/dict'
import { formatSize, formatTime, normalizeColor, reviewMeta } from '@/utils/format'
import { displayUrl } from '@/utils/image'

const dictStore = useDictStore()
const categoryOptions = computed(() => dictStore.categoryOptions)

const router = useRouter()

const pictures = ref([])
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const selectedIds = ref([])

const reviewOpen = ref(false)

const reviewForm = reactive({
  reviewStatus: REVIEW_STATUS.PASS,
  reviewMessage: ''
})

const query = reactive({
  picName: '',
  // 审核台默认聚焦待审核；管理员自己的图不在此列表，管理自己的图走「图片管理」
  reviewStatus: REVIEW_STATUS.PENDING,
  categoryId: undefined,
  picFormat: undefined,
  picColor: '',
  pageNum: 1,
  pageSize: 20,
  sortField: 'createTime',
  sortOrder: SORT_ORDER.DESC
})

const columns = [
  { title: '预览', key: 'thumb', width: 72, fixed: 'left' },
  { title: '图片', key: 'picName', width: 240 },
  { title: '上传者', key: 'uploader', width: 110 },
  { title: '分类', key: 'category', width: 90 },
  { title: '标签', key: 'tags', width: 150 },
  { title: '尺寸 / 体积', key: 'size', width: 120 },
  { title: '主色调', key: 'color', width: 100 },
  { title: '审核状态', key: 'reviewStatus', width: 140 },
  { title: '上传时间', key: 'createTime', width: 140 },
  { title: '操作', key: 'action', width: 90, fixed: 'right' }
]

const pagination = computed(() => ({
  current: query.pageNum,
  pageSize: query.pageSize,
  total: total.value,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showSizeChanger: true,
  showTotal: (t) => `共 ${t} 条`
}))

const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys) => {
    selectedIds.value = keys
  },
  preserveSelectedRowKeys: true
}))

const reviewTargets = ref([])

const reviewTargetNames = computed(() => {
  if (reviewTargets.value.length === 1) {
    return reviewTargets.value[0].picName || `图片 #${reviewTargets.value[0].id}`
  }
  return `${reviewTargets.value.length} 张图片`
})

const reviewTitle = computed(() => (reviewTargets.value.length > 1 ? '批量审核' : '图片审核'))

/**
 * 后端 reviewPicture 的状态机（白名单流转），前端必须跟着限制，否则会被后端拒绝：
 *   待审核 → 通过 / 不通过
 *   已通过 → 不通过（管理员下架，可事后撤回）
 *   已拒绝 → 不允许直接改（须作者修改后重新提交）
 *   相同状态的重复操作也会被拒
 */
function reviewable(pic) {
  return pic?.reviewStatus === REVIEW_STATUS.PENDING || pic?.reviewStatus === REVIEW_STATUS.PASS
}

/** 「通过」只在全部目标都是「待审核」时可选 */
const canPass = computed(
  () =>
    reviewTargets.value.length > 0 &&
    reviewTargets.value.every((p) => p.reviewStatus === REVIEW_STATUS.PENDING)
)

/** 「不通过」对所有待审核 / 已通过的目标都可用 */
const canReject = computed(
  () => reviewTargets.value.length > 0 && reviewTargets.value.every((p) => reviewable(p))
)

const reviewHint = computed(() => {
  if (!reviewTargets.value.length) return ''
  if (!canPass.value) {
    return '所选图片已不在「待审核」状态，只能判为不通过（用于下架已通过的图片）。'
  }
  return '判为不通过后图片会从首页图库下架，作者修改并重新提交前无法再次改状态。'
})

function buildParams() {
  return {
    picName: query.picName || undefined,
    reviewStatus: query.reviewStatus ?? undefined,
    categoryId: query.categoryId ?? undefined,
    picFormat: query.picFormat || undefined,
    picColor: query.picColor || undefined,
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    sortField: query.sortField,
    sortOrder: query.sortOrder
  }
}

async function fetchList() {
  loading.value = true
  try {
    // 审核页只列他人上传的公共图片（管理员自己的图由后端排除），与「图片管理」的数据源互不相干
    const page = await queryReviewPictureList(buildParams())
    pictures.value = page?.records || []
    total.value = Number(page?.total || 0)
  } catch (e) {
    pictures.value = []
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
  query.picName = ''
  query.reviewStatus = REVIEW_STATUS.PENDING
  query.categoryId = undefined
  query.picFormat = undefined
  query.picColor = ''
  query.pageNum = 1
  fetchList()
}

function handleTableChange(pager) {
  query.pageNum = pager.current
  query.pageSize = pager.pageSize
  fetchList()
}

function clearSelection() {
  selectedIds.value = []
}

function goDetail(pic) {
  router.push(`/picture/${pic.id}`)
}

function openReview(record) {
  if (!reviewable(record)) return
  reviewTargets.value = [record]
  // 已通过的图片只能往「不通过」流转，直接预置该选项
  reviewForm.reviewStatus =
    record.reviewStatus === REVIEW_STATUS.PASS ? REVIEW_STATUS.REJECT : REVIEW_STATUS.PASS
  reviewForm.reviewMessage = ''
  reviewOpen.value = true
}

function openBatchReview() {
  const picked = pictures.value.filter((p) => selectedIds.value.includes(p.id))
  // 已拒绝的图片后端不允许再改状态，直接跳过，避免整批请求失败
  const targets = picked.filter((p) => reviewable(p))
  const skipped = picked.length - targets.length
  if (!targets.length) {
    message.warning('所选图片都处于「审核拒绝」状态，需作者修改后重新提交才能再次审核')
    return
  }
  if (skipped) message.info(`已跳过 ${skipped} 张处于「审核拒绝」状态的图片`)
  reviewTargets.value = targets
  reviewForm.reviewStatus = canPass.value ? REVIEW_STATUS.PASS : REVIEW_STATUS.REJECT
  reviewForm.reviewMessage = ''
  reviewOpen.value = true
}

async function handleReviewSubmit() {
  const status = reviewForm.reviewStatus
  const reviewMessage = (reviewForm.reviewMessage || '').trim()
  if (status === REVIEW_STATUS.REJECT && !reviewMessage) {
    message.warning('判为不通过时必须填写审核意见，作者才能知道要改什么')
    return
  }
  // 只提交当前状态允许流转的目标（通过：仅待审核；不通过：待审核 / 已通过）
  const targets = reviewTargets.value.filter((p) =>
    status === REVIEW_STATUS.PASS ? p.reviewStatus === REVIEW_STATUS.PENDING : reviewable(p)
  )
  if (!targets.length) {
    message.warning('所选图片的当前状态不允许该操作，请刷新列表后重试')
    return
  }
  submitting.value = true
  try {
    await Promise.all(
      targets.map((p) =>
        reviewPicture({
          pictureId: p.id,
          reviewStatus: status,
          reviewMessage: reviewMessage || undefined
        })
      )
    )
    message.success(`已处理 ${targets.length} 张图片`)
    reviewOpen.value = false
    clearSelection()
    fetchList()
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  dictStore.load()
  fetchList()
})
</script>

<style scoped lang="less">
.page-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 760px;
  margin-top: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #f7f8fc;
  border: 1px solid var(--border);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.tip-icon {
  margin-top: 3px;
  color: var(--brand);
  flex-shrink: 0;
}

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

.filter-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-radius: var(--radius);
  background: var(--brand-soft);
  border: 1px solid #d7d9fb;
}

.batch-count {
  font-size: 13px;
  font-weight: 550;
  color: #3730a3;
}

.table-card {
  padding: 6px 8px 2px;
}

.taxonomy-tag {
  margin: 0;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 6px;
  background: #f2f3ff;
  border: 1px solid #e0e2f5;
  color: #4338ca;
}

.cell-thumb {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  background: #eceef4;
  cursor: pointer;
  display: block;
}

.name-link {
  color: var(--text);
  font-weight: 550;
  cursor: pointer;
  display: block;
}

.name-link:hover {
  color: var(--brand);
}

.cell-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  max-width: 200px;
}

.uploader-name {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 96px;
}

.action-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  cursor: help;
}

.color-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.review-target {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.review-hint {
  margin-bottom: 16px;
}
</style>
