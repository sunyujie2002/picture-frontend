<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ title }}</h1>
        <p class="page-subtitle">{{ description }}</p>
      </div>
      <a-space>
        <a-button :loading="loading" @click="reload">
          <template #icon>
            <ReloadOutlined />
          </template>
          刷新
        </a-button>
        <a-button type="primary" :disabled="!isAdmin" @click="openCreate">
          <template #icon>
            <PlusOutlined />
          </template>
          新建{{ label }}
        </a-button>
      </a-space>
    </div>

    <a-alert
      v-if="!isAdmin"
      class="perm-alert"
      type="warning"
      show-icon
      :message="`${label}的增删改仅管理员可用`"
      description="当前账号不是管理员，只能查看列表，无法新建、改名或删除。"
    />

    <section class="surface-card">
      <div class="toolbar">
        <a-input-search
          v-model:value="keyword"
          :placeholder="`按${label}名称筛选`"
          allow-clear
          style="max-width: 320px"
        />
        <span class="text-tertiary count-text">
          共 {{ filteredRows.length }} 个{{ label }}<template v-if="keyword && rows.length !== filteredRows.length">
            / {{ rows.length }}</template
          >
        </span>
        <a-tooltip v-if="isAdmin" :title="dragHint">
          <span class="drag-tip">
            <HolderOutlined />
            {{ keyword ? '筛选状态下不可拖拽' : '拖动行可调整展示顺序' }}
          </span>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredRows"
        :loading="loading"
        :pagination="pagination"
        :custom-row="customRow"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #emptyText>
          <a-empty :description="loading ? '' : `还没有${label}，点右上角新建`" />
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'sort'">
            <span class="sort-cell" :class="{ 'is-disabled': !canDrag }">
              <HolderOutlined class="drag-handle" />
              <span class="sort-value">{{ record.sort ?? '—' }}</span>
            </span>
          </template>

          <template v-else-if="column.key === 'id'">
            <span class="id-cell">#{{ record.id }}</span>
          </template>

          <template v-else-if="column.key === 'name'">
            <a-tag class="name-tag">{{ record[nameKey] }}</a-tag>
          </template>

          <template v-else-if="column.key === 'createTime'">
            {{ formatTime(record.createTime) }}
          </template>

          <template v-else-if="column.key === 'editTime'">
            {{ formatTime(record.editTime) || '—' }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" :disabled="!isAdmin" @click="openEdit(record)">改名</a-button>
              <a-button type="link" size="small" danger :disabled="!isAdmin" @click="handleDelete(record)">
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? `修改${label}` : `新建${label}`"
      :confirm-loading="submitting"
      :ok-text="editing ? '保存' : '创建'"
      cancel-text="取消"
      @ok="handleSubmit"
    >
      <a-form layout="vertical">
        <a-form-item
          :label="`${label}名称`"
          v-bind="validateState"
        >
          <a-input
            v-model:value="formName"
            :placeholder="`请输入${label}名称`"
            :maxlength="32"
            show-count
            allow-clear
            @press-enter="handleSubmit"
          />
        </a-form-item>
        <a-form-item :label="`排序值`">
          <a-input-number
            v-model:value="formSort"
            :min="0"
            :precision="0"
            :style="{ width: '160px' }"
            placeholder="留空则排在最后"
          />
          <span class="field-hint">数字越小越靠前；也可以直接在列表里拖动行调整。</span>
        </a-form-item>
      </a-form>
      <p class="modal-hint">{{ nameHint }}</p>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { HolderOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { addCategory, deleteCategory, updateCategory, updateCategorySort } from '@/api/category'
import { addTag, deleteTag, updateTag, updateTagSort } from '@/api/tag'
import { useDictStore } from '@/stores/dict'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/format'

const props = defineProps({
  /** category | tag */
  type: { type: String, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' }
})

const isCategory = computed(() => props.type === 'category')
const label = computed(() => (isCategory.value ? '分类' : '标签'))
const nameKey = computed(() => (isCategory.value ? 'categoryName' : 'tagName'))

const api = computed(() =>
  isCategory.value
    ? { add: addCategory, update: updateCategory, remove: deleteCategory, sort: updateCategorySort }
    : { add: addTag, update: updateTag, remove: deleteTag, sort: updateTagSort }
)

const nameHint = computed(() =>
  isCategory.value
    ? '分类名称不能与其他分类重名；若分类下还有图片，需要先调整这些图片的分类才能删除。'
    : '标签名称全局唯一；删除标签会同步清理图片与标签的关联关系。'
)

const userStore = useUserStore()
const dictStore = useDictStore()
const isAdmin = computed(() => userStore.isAdmin)

const keyword = ref('')
const loading = ref(false)
const submitting = ref(false)
const modalOpen = ref(false)
const editing = ref(null)
const formName = ref('')
const formSort = ref(null)
const validateState = ref({})

/** 分页（后端一次性返回全量，分页在前端做） */
const pageNum = ref(1)
const pageSize = ref(20)
/** 拖拽中的行下标，-1 表示未拖拽 */
const dragIndex = ref(-1)
const savingSort = ref(false)

const storeRows = computed(() => (isCategory.value ? dictStore.adminCategories : dictStore.adminTags))
/** 本地副本：拖拽排序要改动顺序，不能直接改 store 里的数组 */
const rows = ref([])

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((r) => String(r[nameKey.value] || '').toLowerCase().includes(kw))
})

/** 筛选状态下顺序是子集，拖出来的结果没法稳定写回全量列表，此时禁用拖拽 */
const canDrag = computed(() => isAdmin.value && !keyword.value.trim() && !savingSort.value)

const dragHint = computed(() =>
  keyword.value
    ? '清空筛选后才能拖拽排序'
    : `按住任意行上下拖动即可调整${label.value}的展示顺序，保存后全站生效`
)

const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total) => `共 ${total} 个${label.value}`,
  hideOnSinglePage: false
}))

const columns = computed(() => [
  { title: '排序', key: 'sort', width: 90 },
  { title: 'ID', key: 'id', width: 80 },
  { title: `${label.value}名称`, key: 'name' },
  { title: '创建时间', key: 'createTime', width: 180 },
  { title: '最近编辑', key: 'editTime', width: 180 },
  { title: '操作', key: 'action', width: 140, align: 'right' }
])

function handleTableChange(pager) {
  pageNum.value = pager.current
  pageSize.value = pager.pageSize
}

// 筛选词变化后回到第一页，避免停在一个已经不存在的页码上
watch(keyword, () => {
  pageNum.value = 1
})

async function reload() {
  loading.value = true
  try {
    await dictStore.loadAdmin(true)
    // 后端已按 sort 升序返回，本地副本保持同一顺序
    rows.value = [...storeRows.value]
  } finally {
    loading.value = false
  }
}

/** 行拖拽：整行可拖，手柄只是视觉提示 */
function customRow(record, index) {
  if (!canDrag.value) return {}
  return {
    draggable: true,
    style: { cursor: 'move' },
    onDragstart: (e) => {
      dragIndex.value = index
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragover: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onDrop: (e) => {
      e.preventDefault()
      handleDrop(index)
    },
    onDragend: () => {
      dragIndex.value = -1
    }
  }
}

async function handleDrop(targetIndex) {
  const from = dragIndex.value
  dragIndex.value = -1
  if (from < 0 || from === targetIndex) return
  const next = [...rows.value]
  const [moved] = next.splice(from, 1)
  next.splice(targetIndex, 0, moved)
  const prevOrder = rows.value
  rows.value = next
  await saveOrder(next, prevOrder)
}

/**
 * 保存排序：按当前列表顺序写 sort = 下标 + 1，只提交顺序发生变化的条目
 * @param {Array} next 新顺序
 * @param {Array} prev 旧顺序，用于失败回滚
 */
async function saveOrder(next, prev) {
  // 只提交排序值真正变化的条目
  const items = next
    .map((row, index) => ({ id: row.id, sort: index + 1 }))
    .filter((item) => {
      const old = prev.find((r) => String(r.id) === String(item.id))
      return !old || old.sort !== item.sort
    })
  if (!items.length) return

  savingSort.value = true
  try {
    await api.value.sort(items)
    message.success('排序已保存')
    await dictStore.refreshAll()
    rows.value = [...storeRows.value]
  } catch (e) {
    // 保存失败回滚到拖动前的顺序，避免界面和库里不一致
    rows.value = [...prev]
    message.error('排序保存失败，已恢复原顺序')
  } finally {
    savingSort.value = false
  }
}

function openCreate() {
  editing.value = null
  formName.value = ''
  formSort.value = null
  validateState.value = {}
  modalOpen.value = true
}

function openEdit(record) {
  editing.value = record
  formName.value = record[nameKey.value] || ''
  formSort.value = record.sort ?? null
  validateState.value = {}
  modalOpen.value = true
}

async function handleSubmit() {
  const name = formName.value.trim()
  if (!name) {
    validateState.value = {
      validateStatus: 'error',
      help: `${label.value}名称不能为空`
    }
    return
  }
  validateState.value = {}

  // 排序值留空表示不指定：新增时由后端排在最后，编辑时不改动原排序
  const sort = formSort.value === null || formSort.value === '' ? undefined : Number(formSort.value)

  submitting.value = true
  try {
    if (editing.value) {
      await api.value.update({ id: editing.value.id, [nameKey.value]: name, sort })
      message.success(`${label.value}已更新`)
    } else {
      await api.value.add({ [nameKey.value]: name, sort })
      message.success(`${label.value}创建成功`)
    }
    modalOpen.value = false
    await dictStore.refreshAll()
    rows.value = [...storeRows.value]
  } catch (e) {
    /* 拦截器已提示具体原因（重名 / 被引用 / 无权限等） */
  } finally {
    submitting.value = false
  }
}

function handleDelete(record) {
  Modal.confirm({
    title: `确认删除${label.value}「${record[nameKey.value]}」？`,
    content: isCategory.value
      ? '删除后不可恢复。若该分类下仍有图片，请先调整这些图片的分类。'
      : '删除后不可恢复，同时会清理所有图片与该标签的关联。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await api.value.remove(record.id)
        message.success(`${label.value}已删除`)
        await dictStore.refreshAll()
        rows.value = [...storeRows.value]
      } catch (e) {
        /* 拦截器已提示 */
      }
    }
  })
}

onMounted(reload)
</script>

<style scoped lang="less">
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 660;
}

.page-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.perm-alert {
  margin-top: 16px;
}

.surface-card {
  margin-top: 16px;
  padding: 16px 18px 6px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.count-text {
  font-size: 13px;
}

.id-cell {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.drag-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: help;
}

.sort-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.sort-cell .drag-handle {
  color: var(--text-tertiary);
  cursor: move;
}

/* 筛选状态 / 非管理员：手柄不再提示可拖拽 */
.sort-cell.is-disabled .drag-handle {
  color: var(--border);
  cursor: default;
}

.sort-value {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.field-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.name-tag {
  margin: 0;
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 6px;
  background: #f2f3ff;
  border: 1px solid #e0e2f5;
  color: #4338ca;
}

.modal-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-tertiary);
}
</style>
