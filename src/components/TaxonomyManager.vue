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
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredRows"
        :loading="loading"
        :pagination="filteredRows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false"
        row-key="id"
        size="middle"
      >
        <template #emptyText>
          <a-empty :description="loading ? '' : `还没有${label}，点右上角新建`" />
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'id'">
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
      :title="editing ? `修改${label}名称` : `新建${label}`"
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
      </a-form>
      <p class="modal-hint">{{ nameHint }}</p>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { addCategory, deleteCategory, updateCategory } from '@/api/category'
import { addTag, deleteTag, updateTag } from '@/api/tag'
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
    ? { add: addCategory, update: updateCategory, remove: deleteCategory }
    : { add: addTag, update: updateTag, remove: deleteTag }
)

const nameHint = computed(() =>
  isCategory.value
    ? '分类名称全局唯一，重名会被后端拒绝；删除时若仍有图片引用该分类，后端同样会拒绝。'
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
const validateState = ref({})

const rows = computed(() => (isCategory.value ? dictStore.adminCategories : dictStore.adminTags))

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((r) => String(r[nameKey.value] || '').toLowerCase().includes(kw))
})

const columns = computed(() => [
  { title: 'ID', key: 'id', width: 80 },
  { title: `${label.value}名称`, key: 'name' },
  { title: '创建时间', key: 'createTime', width: 180 },
  { title: '最近编辑', key: 'editTime', width: 180 },
  { title: '操作', key: 'action', width: 140, align: 'right' }
])

async function reload() {
  loading.value = true
  try {
    await dictStore.loadAdmin(true)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  formName.value = ''
  validateState.value = {}
  modalOpen.value = true
}

function openEdit(record) {
  editing.value = record
  formName.value = record[nameKey.value] || ''
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

  submitting.value = true
  try {
    if (editing.value) {
      await api.value.update({ id: editing.value.id, [nameKey.value]: name })
      message.success(`${label.value}已更新`)
    } else {
      await api.value.add({ [nameKey.value]: name })
      message.success(`${label.value}创建成功`)
    }
    modalOpen.value = false
    await dictStore.refreshAll()
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
      ? '删除后不可恢复。若该分类下仍有图片，后端会拒绝删除，需要先调整这些图片的分类。'
      : '删除后不可恢复，同时会清理所有图片与该标签的关联。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await api.value.remove(record.id)
        message.success(`${label.value}已删除`)
        await dictStore.refreshAll()
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
