<template>
  <div class="page">
    <div class="page-head head-row">
      <div>
        <h1 class="page-title">用户管理</h1>
        <p class="page-subtitle">查询、新增与维护平台账号，调整用户角色。</p>
      </div>
      <a-button type="primary" @click="openAdd">
        <template #icon>
          <PlusOutlined />
        </template>
        新增用户
      </a-button>
    </div>

    <section class="filter-bar surface-card">
      <div class="filter-fields">
        <a-input
          v-model:value="query.userAccount"
          placeholder="按账号搜索"
          allow-clear
          style="width: 180px"
          @press-enter="onSearch"
        />
        <a-input
          v-model:value="query.userName"
          placeholder="按昵称搜索"
          allow-clear
          style="width: 180px"
          @press-enter="onSearch"
        />
        <a-select
          v-model:value="query.userRole"
          placeholder="角色"
          :options="USER_ROLE_OPTIONS"
          allow-clear
          style="width: 130px"
          @change="onSearch"
        />
        <a-button type="primary" @click="onSearch">查询</a-button>
        <a-button type="link" @click="resetFilter">重置</a-button>
      </div>
    </section>

    <div class="surface-card table-card">
      <a-table
        :columns="columns"
        :data-source="users"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 1000 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <div class="user-cell">
              <a-avatar :src="resolveImageUrl(record.userAvatar)" :size="36" class="user-avatar">
                {{ (record.userName || record.userAccount || 'U').charAt(0) }}
              </a-avatar>
              <div class="user-text">
                <div class="user-name ellipsis-1">{{ record.userName || '未设置昵称' }}</div>
                <div class="cell-sub">{{ record.userAccount }}</div>
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'userProfile'">
            <span class="ellipsis-1" :title="record.userProfile">{{ record.userProfile || '-' }}</span>
          </template>

          <template v-else-if="column.key === 'userRole'">
            <a-tag :color="userRoleMeta(record.userRole).color">{{ userRoleMeta(record.userRole).label }}</a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-popconfirm
                title="确认删除该用户？"
                ok-text="删除"
                cancel-text="取消"
                :disabled="record.id === userStore.userId"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger :disabled="record.id === userStore.userId">删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 新增 / 编辑用户 -->
    <a-modal
      v-model:open="modalOpen"
      :title="isEdit ? '编辑用户' : '新增用户'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="submitting"
      @ok="handleSubmit"
    >
      <!-- 新增时后端只接受账号 / 昵称 / 角色：密码固定 123456，头像与简介不入参 -->
      <a-alert
        v-if="!isEdit"
        class="mode-tip"
        type="info"
        show-icon
        message="新增用户只设置账号、昵称与角色"
        description="初始密码由后端固定为 123456，账号与昵称均不可与他人重复；头像与简介请在创建后再编辑。"
      />

      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item v-if="!isEdit" name="userAccount" label="账号">
          <a-input v-model:value="form.userAccount" placeholder="登录账号" allow-clear />
        </a-form-item>
        <a-form-item name="userName" label="用户昵称">
          <a-input v-model:value="form.userName" placeholder="展示昵称，不能与他人重复" allow-clear />
        </a-form-item>
        <a-form-item name="userRole" label="用户角色">
          <a-radio-group v-model:value="form.userRole" button-style="solid">
            <a-radio-button v-for="r in USER_ROLE_OPTIONS" :key="r.value" :value="r.value">
              {{ r.label }}
            </a-radio-button>
          </a-radio-group>
        </a-form-item>

        <template v-if="isEdit">
          <a-form-item name="userProfile" label="用户简介">
            <a-textarea
              v-model:value="form.userProfile"
              :rows="3"
              :maxlength="200"
              show-count
              placeholder="一句话介绍"
            />
          </a-form-item>
        </template>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { addUser, deleteUser, queryUserList, updateUser } from '@/api/user'
import { uploadPicture } from '@/api/picture'
import { PAGE_SIZE_OPTIONS, SORT_ORDER, USER_ROLE_OPTIONS } from '@/constants'
import { formatTime, userRoleMeta } from '@/utils/format'
import { resolveImageUrl } from '@/utils/image'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const users = ref([])
const total = ref(0)
const loading = ref(false)
const submitting = ref(false)
const avatarUploading = ref(false)
const modalOpen = ref(false)
const isEdit = ref(false)
const formRef = ref()

const query = reactive({
  userAccount: '',
  userName: '',
  userRole: undefined,
  pageNum: 1,
  pageSize: 20,
  sortField: 'createTime',
  sortOrder: SORT_ORDER.DESC
})

const emptyForm = () => ({
  id: undefined,
  userAccount: '',
  userName: '',
  userProfile: '',
  userRole: 'user'
})

const form = reactive(emptyForm())

/**
 * 后端约束（UserServiceImpl）：
 * addUser 要求账号 / 昵称 / 角色三者都非空，且账号与昵称都不能重复；
 * updateUser 由 BeanUtil 整体拷贝，账号、昵称、头像、简介、角色都能改，id 必填。
 */
const rules = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 2, max: 32, message: '账号长度需在 2 ~ 32 个字符之间', trigger: 'blur' }
  ],
  userName: [{ required: true, message: '请输入用户昵称', trigger: 'blur' }],
  userRole: [{ required: true, message: '请选择用户角色', trigger: 'change' }]
}

const columns = [
  { title: '用户', key: 'user', width: 220 },
  { title: 'ID', dataIndex: 'id', width: 110 },
  { title: '简介', key: 'userProfile', width: 200 },
  { title: '角色', key: 'userRole', width: 100 },
  { title: '编辑时间', dataIndex: 'editTime', width: 150, customRender: ({ text }) => formatTime(text) },
  { title: '创建时间', dataIndex: 'createTime', width: 150, customRender: ({ text }) => formatTime(text) },
  { title: '操作', key: 'action', width: 130, fixed: 'right' }
]

const pagination = computed(() => ({
  current: query.pageNum,
  pageSize: query.pageSize,
  total: total.value,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showSizeChanger: true,
  showTotal: (t) => `共 ${t} 条`
}))

function buildParams() {
  return {
    userAccount: query.userAccount || undefined,
    userName: query.userName || undefined,
    userRole: query.userRole || undefined,
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    sortField: query.sortField,
    sortOrder: query.sortOrder
  }
}

async function fetchList() {
  loading.value = true
  try {
    const page = await queryUserList(buildParams())
    users.value = page?.records || []
    total.value = Number(page?.total || 0)
  } catch (e) {
    users.value = []
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
  query.userAccount = ''
  query.userName = ''
  query.userRole = undefined
  query.pageNum = 1
  fetchList()
}

function handleTableChange(pager) {
  query.pageNum = pager.current
  query.pageSize = pager.pageSize
  fetchList()
}

function openAdd() {
  isEdit.value = false
  Object.assign(form, emptyForm())
  modalOpen.value = true
  formRef.value?.clearValidate()
}

function openEdit(record) {
  isEdit.value = true
  Object.assign(form, {
    id: record.id,
    userAccount: record.userAccount || '',
    userName: record.userName || '',
    userProfile: record.userProfile || '',
    userRole: record.userRole || 'user'
  })
  modalOpen.value = true
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      // 编辑：后端整体拷贝，可提交全部字段（空值按原样保留，由 MyBatis-Plus 忽略 null）
      await updateUser({
        id: form.id,
        userAccount: form.userAccount,
        userName: form.userName,
        userProfile: form.userProfile ?? '',
        userRole: form.userRole
      })
      message.success('用户已更新')
    } else {
      // 新增：后端只取账号 / 昵称 / 角色，头像与简介传了也会被忽略
      await addUser({
        userAccount: form.userAccount,
        userName: form.userName,
        userRole: form.userRole
      })
      message.success('用户已创建，初始密码为 123456')
    }
    modalOpen.value = false
    fetchList()
  } catch (e) {
    /* 拦截器已提示（如「用户昵称已存在」） */
  } finally {
    submitting.value = false
  }
}

/**
 * 头像上传：复用图片上传接口，后端返回对象存储相对路径（temp/image/{userId}/...），
 * 直接作为 userAvatar 提交。
 */
async function handleAvatarUpload(file) {
  avatarUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const vo = await uploadPicture(formData)
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    avatarUploading.value = false
  }
  // 阻止 a-upload 自带的上传行为
  return false
}

async function handleDelete(record) {
  try {
    await deleteUser(record.id)
    message.success('用户已删除')
    fetchList()
  } catch (e) {
    /* 拦截器已提示 */
  }
}

function onAvatarError(e) {
  e.target.style.display = 'none'
}

onMounted(fetchList)
</script>

<style scoped lang="less">
.head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
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

.table-card {
  padding: 6px 8px 2px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
}

.user-text {
  min-width: 0;
}

.user-name {
  font-weight: 550;
}

.cell-sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.mode-tip {
  margin-bottom: 18px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.avatar-field {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.avatar-preview {
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg);
  display: grid;
  place-items: center;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-empty {
  font-size: 12px;
  color: var(--text-tertiary);
}

.avatar-side {
  flex: 1;
  min-width: 0;
}

.avatar-input {
  margin-top: 10px;
}
</style>
