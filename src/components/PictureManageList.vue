<template>
  <div class="manage-list">
    <section class="filter-bar surface-card">
      <div class="filter-fields">
        <a-input
          v-model:value="query.picName"
          placeholder="按名称搜索"
          allow-clear
          style="width: 200px"
          @press-enter="onSearch"
        >
          <template #prefix>
            <SearchOutlined class="field-icon" />
          </template>
        </a-input>

        <a-select
          v-if="showReview"
          v-model:value="query.reviewStatus"
          :options="REVIEW_STATUS_OPTIONS"
          placeholder="审核状态"
          allow-clear
          style="width: 130px"
          @change="onSearch"
        />

        <a-select
          v-model:value="query.categoryId"
          :options="categoryOptions"
          placeholder="分类"
          allow-clear
          show-search
          option-filter-prop="label"
          style="width: 150px"
          @change="onSearch"
        />

        <a-select
          v-model:value="query.picFormat"
          :options="PIC_FORMAT_OPTIONS"
          placeholder="格式"
          allow-clear
          style="width: 110px"
          @change="onSearch"
        />

        <ColorPicker v-model="query.picColor" @change="onSearch" />

        <a-button type="primary" @click="onSearch">查询</a-button>
        <a-button type="link" @click="resetFilter">重置</a-button>

        <a-radio-group v-model:value="view" button-style="solid" size="small" class="view-switch">
          <a-radio-button value="table">
            <TableOutlined />
            表格
          </a-radio-button>
          <a-radio-button value="card">
            <AppstoreOutlined />
            卡片
          </a-radio-button>
        </a-radio-group>
      </div>
    </section>

    <!-- 批量操作条 -->
    <transition name="fade-slide">
      <section v-if="selectedIds.length" class="batch-bar">
        <span class="batch-count">已选择 {{ selectedIds.length }} 张图片</span>
        <a-space>
          <a-button size="small" @click="openBatchEdit">
            <template #icon>
              <EditOutlined />
            </template>
            批量改分类 / 标签
          </a-button>
          <a-popconfirm
            title="确认批量删除所选图片？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="handleBatchDelete"
          >
            <a-button size="small" danger>
              <template #icon>
                <DeleteOutlined />
              </template>
              批量删除
            </a-button>
          </a-popconfirm>
          <a-button size="small" type="link" @click="clearSelection">取消选择</a-button>
        </a-space>
      </section>
    </transition>

    <div class="surface-card list-card">
      <a-spin :spinning="loading">
        <template v-if="pictures.length">
          <!-- 表格视图 -->
          <a-table
            v-if="view === 'table'"
            :columns="columns"
            :data-source="pictures"
            :pagination="false"
            :loading="false"
            row-key="id"
            :row-selection="rowSelection"
            :scroll="{ x: scrollX }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'thumb'">
                <img :src="displayUrl(record)" :alt="record.picName" class="cell-thumb" @click="goDetail(record)" />
              </template>

              <template v-else-if="column.key === 'picName'">
                <a class="name-link ellipsis-1" :title="record.picName" @click="goDetail(record)">
                  {{ record.picName || '未命名图片' }}
                </a>
                <div class="cell-sub ellipsis-1" :title="record.introduction || '暂无简介'">{{ record.introduction || '暂无简介' }}</div>
              </template>

              <template v-else-if="column.key === 'category'">
                <a-tag v-if="record.categoryId" class="taxonomy-tag">
                  {{ dictStore.categoryName(record.categoryId) }}
                </a-tag>
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
                <div v-if="record.reviewStatus === REVIEW_STATUS.REJECT && record.reviewMessage" class="cell-sub ellipsis-1" :title="record.reviewMessage">
                  {{ record.reviewMessage }}
                </div>
              </template>

              <template v-else-if="column.key === 'createTime'">
                {{ formatTime(record.createTime) }}
              </template>

              <template v-else-if="column.key === 'action'">
                <a-space :size="4">
                  <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
                  <a-button v-if="enableCanvasEdit" type="link" size="small" @click="openCanvasEdit(record)">
                    图片编辑
                  </a-button>
                  <a-popconfirm
                    title="确认删除这张图片？"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="() => doDelete(record)"
                  >
                    <a-button type="link" size="small" danger>删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>

          <!-- 卡片视图 -->
          <div v-else class="card-wrap">
            <PictureGrid :items="pictures" :gap="18">
              <template #default="{ item }">
                <PictureCard
                  :picture="item"
                  selectable
                  editable
                  show-time
                  :checked="selectedIds.includes(item.id)"
                  @click="goDetail"
                  @detail="goDetail"
                  @download="handleDownload"
                  @edit="openEdit"
                  @canvas-edit="openCanvasEdit"
                  @delete="confirmDelete"
                  @check-change="onCheckChange"
                />
              </template>
            </PictureGrid>
          </div>

          <div class="pager">
            <a-pagination
              v-model:current="query.pageNum"
              v-model:pageSize="query.pageSize"
              :total="total"
              :page-size-options="PAGE_SIZE_OPTIONS"
              show-size-changer
              :show-total="(t) => `共 ${t} 张`"
              @change="fetchList"
            />
          </div>
        </template>

        <!-- 空态：页面可通过 #empty 插槽完全自定义 -->
        <div v-else-if="!loading" class="empty-wrap">
          <slot name="empty">
            <a-empty :description="emptyTitle" class="state-box">
              <slot name="empty-action" />
            </a-empty>
          </slot>
        </div>
      </a-spin>
    </div>

    <PictureEditModal
      v-model:open="editOpen"
      :picture="current"
      :submitting="submitting"
      @submit="handleEditSubmit"
    />

    <!-- 画布编辑器：多人协作的图片编辑，保存后才真正覆盖原图 -->
    <PictureEditorModal
      v-model:open="canvasOpen"
      :picture="current"
      :collaborative="collaborative"
      @saved="onCanvasSaved"
    />

    <!-- 批量修改弹窗 -->
    <a-modal
      v-model:open="batchOpen"
      title="批量修改"
      ok-text="确认修改"
      cancel-text="取消"
      :confirm-loading="submitting"
      @ok="handleBatchEditSubmit"
    >
      <p class="batch-tip">将对选中的 {{ selectedIds.length }} 张图片生效；留空表示不修改该项。</p>
      <a-form layout="vertical" :model="batchForm">
        <a-form-item label="分类">
          <a-select
            v-model:value="batchForm.categoryId"
            :options="categoryOptions"
            placeholder="留空表示不修改"
            allow-clear
            show-search
            option-filter-prop="label"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="标签">
          <a-select
            v-model:value="batchForm.tagIds"
            mode="multiple"
            :options="tagOptions"
            placeholder="留空表示不修改，可多选"
            allow-clear
            style="width: 100%"
          />
          <div class="batch-hint">标签由管理员统一维护，如需新标签请先在「管理后台 - 标签管理」中创建。</div>
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  TableOutlined
} from '@ant-design/icons-vue'
import PictureGrid from '@/components/PictureGrid.vue'
import PictureCard from '@/components/PictureCard.vue'
import PictureEditModal from '@/components/PictureEditModal.vue'
import PictureEditorModal from '@/components/PictureEditorModal.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { batchDeletePicture, batchEditPicture, deletePicture, updatePicture } from '@/api/picture'
import {
  PAGE_SIZE_OPTIONS,
  PIC_FORMAT_OPTIONS,
  REVIEW_STATUS,
  REVIEW_STATUS_OPTIONS,
  SORT_ORDER
} from '@/constants'
import { useDictStore } from '@/stores/dict'
import { useSpaceStore } from '@/stores/space'
import { downloadPicture, formatSize, formatTime, normalizeColor, reviewMeta } from '@/utils/format'
import { displayUrl } from '@/utils/image'
const props = defineProps({
  /** 列表查询函数：(params) => Promise<Page>，由页面决定走公共还是私有接口 */
  fetcher: { type: Function, required: true },
  /**
   * 是否展示审核状态筛选与「审核状态」列（公共图片列表需要）。
   * 注意：这里只是**只读展示**与筛选，审核操作不在此组件内，
   * 管理员审核他人图片统一走 queryReviewPictureList（/admin/pictures 审核页）。
   */
  showReview: { type: Boolean, default: false },
  /** 默认视图：table / card */
  defaultView: { type: String, default: 'table' },
  emptyTitle: { type: String, default: '这里还没有图片' },
  /**
   * 随查询一起提交的固定参数，例如私有图库需要的 { spaceId }。
   * 切换空间时父页面改这个对象即可，组件内部不感知空间概念。
   */
  extraParams: { type: Object, default: () => ({}) },
  /**
   * 是否提供「图片编辑」（画布编辑）入口。
   * 默认开启；团队空间下浏览者（viewer）没有编辑权限，由页面按空间角色关闭。
   */
  enableCanvasEdit: { type: Boolean, default: true },
  /**
   * 画布编辑器是否开启多人协作（只有团队空间的图片需要）。
   * 默认关闭：其余场景（公共图库 / 个人空间 / 审核页）的图片自己编辑就够了，
   * 不需要协作者列表、远端光标这类信息。
   */
  collaborative: { type: Boolean, default: false }
})

const emit = defineEmits(['changed'])

const router = useRouter()
const dictStore = useDictStore()
const spaceStore = useSpaceStore()

const categoryOptions = computed(() => dictStore.categoryOptions)
const tagOptions = computed(() => dictStore.tagOptions)

/**
 * 画布编辑器是否带协作（团队空间的图片才需要）
 *
 * 两个信号取「或」：页面显式传的 `collaborative`，以及按列表实际查询的 spaceId
 * 判断它是不是我的团队空间之一。后者是兜底——只靠页面传值时，一旦空间 store 的
 * 当前类型没跟上（直接进页面 / 缓存回填），团队空间的图片就会漏掉协作能力。
 */
const collaborative = computed(() => {
  if (props.collaborative) return true
  const spaceId = props.extraParams?.spaceId
  if (!spaceId) return false
  return spaceStore.teams.some((item) => item.id === String(spaceId))
})

const pictures = ref([])
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const selectedIds = ref([])
const view = ref(props.defaultView)

const editOpen = ref(false)
const canvasOpen = ref(false)
const batchOpen = ref(false)
const current = ref(null)

const batchForm = reactive({
  categoryId: undefined,
  tagIds: []
})

const query = reactive({
  picName: '',
  // 默认不过滤审核状态：管理页展示自己上传的全部图片，审核状态只作为信息展示
  reviewStatus: null,
  categoryId: undefined,
  picFormat: undefined,
  picColor: '',
  pageNum: 1,
  pageSize: 20,
  sortField: 'createTime',
  sortOrder: SORT_ORDER.DESC
})

const columns = computed(() => {
  const cols = [
    { title: '预览', key: 'thumb', width: 76, fixed: 'left' },
    { title: '名称 / 简介', key: 'picName', width: 220 }
  ]
  cols.push(
    { title: '分类', key: 'category', width: 100 },
    { title: '标签', key: 'tags', width: 170 },
    { title: '尺寸 / 体积', key: 'size', width: 130 },
    { title: '主色调', key: 'color', width: 110 }
  )
  if (props.showReview) cols.push({ title: '审核状态', key: 'reviewStatus', width: 140 })
  cols.push(
    { title: '创建时间', key: 'createTime', width: 150 },
    { title: '操作', key: 'action', width: 190, fixed: 'right' }
  )
  return cols
})

const scrollX = computed(() => {
  let base = 76 + 220 + 100 + 170 + 130 + 110 + 150 + 190
  if (props.showReview) base += 140
  return base
})

const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  onChange: (keys) => {
    selectedIds.value = keys
  },
  preserveSelectedRowKeys: true
}))

function buildParams() {
  return {
    // 空间维度等固定入参：私有图库必须带 spaceId，否则后端会回落到个人空间
    ...(props.extraParams || {}),
    picName: query.picName || undefined,
    // 私有图库接口（QueryHomePictureRequest）没有 reviewStatus 字段，多余字段后端会忽略，这里仍按开关控制
    reviewStatus: props.showReview ? (query.reviewStatus ?? undefined) : undefined,
    categoryId: query.categoryId ?? undefined,
    picFormat: query.picFormat || undefined,
    picColor: query.picColor || undefined,
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    sortField: query.sortField,
    sortOrder: query.sortOrder
  }
}

/**
 * 拉取列表。
 * 注意：查询 / 翻页 / 筛选都不会改变空间容量，这里不 emit('changed')；
 * 只有增删改（可能影响已用容量）的成功回调里才手动 emit，避免父页面重复请求。
 */
async function fetchList() {
  loading.value = true
  try {
    const page = await props.fetcher(buildParams())
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
  query.reviewStatus = undefined
  query.categoryId = undefined
  query.picFormat = undefined
  query.picColor = ''
  query.pageNum = 1
  fetchList()
}

function onCheckChange(id, checked) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
  } else {
    selectedIds.value = selectedIds.value.filter((v) => v !== id)
  }
}

function clearSelection() {
  selectedIds.value = []
}

function goDetail(pic) {
  router.push({ path: `/picture/${pic.id}`, state: { picture: pic } })
}

async function handleDownload(pic) {
  try {
    await downloadPicture(pic)
    message.success('已开始下载')
  } catch (e) {
    message.error(e?.message || '下载失败，请稍后重试')
  }
}

function openEdit(pic) {
  current.value = pic
  editOpen.value = true
}

function openCanvasEdit(pic) {
  current.value = pic
  canvasOpen.value = true
}

/** 画布保存后刷新列表并同步空间容量（图片体积可能变了） */
async function onCanvasSaved() {
  canvasOpen.value = false
  await fetchList()
  emit('changed', total.value)
}

async function handleEditSubmit(values) {
  submitting.value = true
  try {
    await updatePicture(values)
    message.success('图片信息已更新')
    editOpen.value = false
    await fetchList()
    // 编辑可能换了图片（体积变化），通知父页面刷新空间容量
    emit('changed', total.value)
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

/** 卡片视图的删除按钮没有二次确认位，这里补一个确认弹窗 */
function confirmDelete(pic) {
  Modal.confirm({
    title: '确认删除这张图片？',
    content: pic.picName || '',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: () => doDelete(pic)
  })
}

async function doDelete(pic) {
  await deletePicture(pic.id)
  message.success('图片已删除')
  selectedIds.value = selectedIds.value.filter((v) => v !== pic.id)
  await fetchList()
  // 删除会释放空间容量，通知父页面刷新
  emit('changed', total.value)
}

function openBatchEdit() {
  batchForm.categoryId = undefined
  batchForm.tagIds = []
  batchOpen.value = true
}

async function handleBatchEditSubmit() {
  if (!selectedIds.value.length) return
  submitting.value = true
  try {
    await batchEditPicture({
      pictureIds: [...selectedIds.value],
      categoryId: batchForm.categoryId ?? undefined,
      tagIds: batchForm.tagIds?.length ? batchForm.tagIds.map((v) => String(v)) : undefined
    })
    message.success('批量修改成功')
    batchOpen.value = false
    clearSelection()
    fetchList()
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

async function handleBatchDelete() {
  if (!selectedIds.value.length) return
  try {
    await batchDeletePicture([...selectedIds.value])
    message.success('批量删除成功')
    clearSelection()
    await fetchList()
    // 批量删除会释放空间容量，通知父页面刷新
    emit('changed', total.value)
  } catch (e) {
    /* 拦截器已提示 */
  }
}

onMounted(() => {
  dictStore.load()
  fetchList()
})

defineExpose({ refresh: fetchList })
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

.field-icon {
  color: var(--text-tertiary);
}

.view-switch {
  margin-left: auto;
}

.list-card {
  padding: 18px 18px 8px;
}

.card-wrap {
  padding: 4px 0;
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

.cell-thumb {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--border);
}

.name-link {
  cursor: pointer;
  font-weight: 550;
  color: var(--text);
}

.name-link:hover {
  color: var(--brand);
}

.cell-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  max-width: 240px;
}

.color-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  border: 1px solid rgba(31, 36, 48, 0.1);
}

.taxonomy-tag {
  margin: 0;
}

.pager {
  margin: 18px 0 10px;
  display: flex;
  justify-content: flex-end;
}

.empty-wrap {
  padding: 40px 0;
}

.state-box {
  padding: 40px 0;
}

.batch-tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.batch-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
