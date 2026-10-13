<template>
  <section class="surface-card member-panel">
    <!-- 头部：点击折叠 / 展开，右侧操作按钮不触发折叠 -->
    <header class="panel-head" @click="toggle">
      <div class="head-main">
        <span class="head-icon">
          <TeamOutlined />
        </span>
        <div class="head-text">
          <div class="title-row">
            <h2 class="panel-title">空间成员</h2>
            <span class="member-count">{{ members.length }}</span>
            <a-tag v-if="!canManage" class="view-only-tag">仅查看</a-tag>
          </div>
          <p class="panel-sub">{{ panelSub }}</p>
        </div>
      </div>

      <div class="head-aside" @click.stop>
        <!-- 收起状态：头像堆叠 + 角色分布，不展开也能看到大致情况 -->
        <div v-if="collapsed && members.length" class="head-preview">
          <div class="avatar-stack">
            <a-tooltip
              v-for="item in previewMembers"
              :key="item.userId"
              :title="item.userName || '未命名用户'"
            >
              <a-avatar
                :src="resolveImageUrl(item.userAvatar)"
                :size="30"
                class="stack-avatar"
                :class="{ 'is-admin': item.spaceRole === SPACE_ROLE.ADMIN }"
              >
                {{ (item.userName || '?').charAt(0) }}
              </a-avatar>
            </a-tooltip>
            <a-avatar v-if="restCount" :size="30" class="stack-avatar stack-more">
              +{{ restCount }}
            </a-avatar>
          </div>
          <div class="role-chips">
            <span v-for="item in roleStats" :key="item.value" class="role-chip">
              <i class="dot" :style="{ background: item.dotColor }" />
              {{ item.label }}
            </span>
          </div>
        </div>

        <a-space :size="8">
          <a-button :loading="loading" @click="refresh">
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新
          </a-button>
          <a-button v-if="canManage" type="primary" @click="openInvite">
            <template #icon>
              <UserAddOutlined />
            </template>
            邀请成员
          </a-button>
          <a-button class="collapse-btn" type="text" @click="toggle">
            {{ collapsed ? '展开' : '收起' }}
            <DownOutlined v-if="collapsed" />
            <UpOutlined v-else />
          </a-button>
        </a-space>
      </div>
    </header>

    <div v-show="!collapsed" class="panel-body">
      <a-table
        :columns="columns"
        :data-source="members"
        :loading="loading"
        :pagination="false"
        row-key="userId"
        :scroll="{ x: 560 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <div class="user-cell">
              <a-avatar
                :src="resolveImageUrl(record.userAvatar)"
                :size="34"
                class="user-avatar"
                :class="{ 'is-admin': record.spaceRole === SPACE_ROLE.ADMIN }"
              >
                {{ (record.userName || '?').charAt(0) }}
              </a-avatar>
              <div class="user-text">
                <div class="user-name ellipsis-1">
                  {{ record.userName || '用户已注销' }}
                  <a-tag v-if="isSelf(record)" color="green" class="mini-tag">我</a-tag>
                  <a-tag v-if="record.spaceRole === SPACE_ROLE.ADMIN" color="purple" class="mini-tag">
                    创建者
                  </a-tag>
                </div>
                <div class="user-sub">
                  <template v-if="record.userAccount">@{{ record.userAccount }}</template>
                  <template v-if="record.userAccount && record.createTime"> · </template>
                  <template v-if="record.createTime">加入于 {{ formatTime(record.createTime) }}</template>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'role'">
            <a-tag :color="spaceRoleMeta(record.spaceRole).color">
              {{ spaceRoleMeta(record.spaceRole).label }}
            </a-tag>
            <div class="cell-sub">{{ spaceRoleMeta(record.spaceRole).desc }}</div>
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="action-cell">
              <a-button type="link" size="small" @click="openRole(record)">修改角色</a-button>
              <a-popconfirm
                v-if="canRemove(record)"
                title="确认移除该成员？"
                description="移除后该成员将立即失去本空间的访问权限。"
                ok-text="移除"
                cancel-text="取消"
                :ok-button-props="{ danger: true }"
                @confirm="handleRemove(record)"
              >
                <a-button type="link" size="small" danger>移除</a-button>
              </a-popconfirm>
              <a-tooltip v-else title="空间创建者不能被移除，角色也不支持修改">
                <span class="text-tertiary">不可操作</span>
              </a-tooltip>
            </div>
          </template>
        </template>

        <template #emptyText>
          <div class="empty-member">
            <TeamOutlined class="empty-icon" />
            <p>还没有其他成员</p>
            <a-button v-if="canManage" type="primary" size="small" @click="openInvite">邀请成员</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 邀请成员 -->
    <a-modal
      v-model:open="inviteOpen"
      title="邀请成员加入团队空间"
      ok-text="邀请"
      cancel-text="取消"
      :confirm-loading="submitting"
      :ok-button-props="{ disabled: !canSubmit }"
      @ok="handleInvite"
    >
      <a-form layout="vertical">
        <a-form-item label="选择用户">
          <a-select
            v-model:value="inviteForm.userId"
            show-search
            allow-clear
            placeholder="输入昵称或账号搜索"
            :filter-option="false"
            :options="userOptions"
            :not-found-content="searching ? '搜索中…' : keyword ? '没有匹配的用户' : '输入关键词搜索'"
            style="width: 100%"
            @search="onSearchUser"
          />
          <div class="field-hint">搜索结果最多展示 20 条，不含你自己。</div>
        </a-form-item>

        <a-form-item label="空间角色">
          <a-radio-group v-model:value="inviteForm.spaceRole" button-style="solid">
            <a-radio-button
              v-for="item in SPACE_INVITE_ROLE_OPTIONS"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </a-radio-button>
          </a-radio-group>
          <div class="field-hint">{{ inviteRoleDesc }}</div>
        </a-form-item>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="邀请规则"
        description="邀请后立即生效，无需对方同意；管理员角色随空间创建产生，不能被邀请。后续可在成员列表里调整角色。"
      />
    </a-modal>

    <!-- 修改成员角色 -->
    <a-modal
      v-model:open="roleOpen"
      title="修改成员角色"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="submitting"
      :ok-button-props="{ disabled: !roleForm.spaceRole }"
      @ok="handleUpdateRole"
    >
      <p class="role-tip">
        正在修改 <b>{{ roleTarget?.userName || '该成员' }}</b> 在本空间的角色
      </p>
      <a-radio-group v-model:value="roleForm.spaceRole" button-style="solid">
        <a-radio-button
          v-for="item in SPACE_INVITE_ROLE_OPTIONS"
          :key="item.value"
          :value="item.value"
        >
          {{ item.label }}
        </a-radio-button>
      </a-radio-group>
      <div class="field-hint">{{ roleDesc }}</div>
      <a-alert
        class="role-note"
        type="info"
        show-icon
        message="角色说明"
        description="管理员角色随空间创建产生，不能通过修改获得，因此这里只能在浏览者与编辑者之间调整。"
      />
    </a-modal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  DownOutlined,
  ReloadOutlined,
  TeamOutlined,
  UpOutlined,
  UserAddOutlined
} from '@ant-design/icons-vue'
import { searchUsers } from '@/api/user'
import { SPACE_INVITE_ROLE_OPTIONS, SPACE_ROLE, SPACE_ROLE_OPTIONS } from '@/constants'
import { useSpaceStore } from '@/stores/space'
import { useUserStore } from '@/stores/user'
import { formatTime, spaceRoleMeta } from '@/utils/format'
import { resolveImageUrl } from '@/utils/image'

const props = defineProps({
  /** 团队空间 id */
  spaceId: { type: String, default: '' }
})

const spaceStore = useSpaceStore()
const userStore = useUserStore()

const submitting = ref(false)
const inviteOpen = ref(false)
const inviteForm = reactive({ userId: undefined, spaceRole: SPACE_ROLE.VIEWER })
const roleOpen = ref(false)
const roleTarget = ref(null)
const roleForm = reactive({ spaceRole: SPACE_ROLE.VIEWER })

const userOptions = ref([])
const searching = ref(false)
const keyword = ref('')
let searchTimer = null

/** 折叠状态按空间记忆，切回同一个空间时保持上次的展开 / 收起 */
function foldKey(spaceId) {
  return `picture_space_members_fold_${spaceId || 'none'}`
}
const collapsed = ref(false)

const members = computed(() => spaceStore.members)
const loading = computed(() => spaceStore.membersLoading)
/** 只有空间创建者（admin）能邀请、改角色与移除 */
const canManage = computed(() => spaceStore.canManageMembers)

const columns = computed(() => {
  const list = [
    { title: '成员', key: 'user', width: 260 },
    { title: '角色 / 权限', key: 'role', width: 180 }
  ]
  if (canManage.value) {
    list.push({ title: '操作', key: 'action', width: 150, align: 'right' })
  }
  return list
})

const panelSub = computed(() =>
  canManage.value
    ? '按角色分配权限：浏览者只能查看，编辑者可上传与修改，创建者拥有全部权限并可管理成员。'
    : '所有成员都能看到空间里的成员与各自角色，只有空间创建者可以邀请、调整角色或移除成员。'
)

/** 收起时的头像预览：最多 5 个，其余折叠成 +N */
const previewMembers = computed(() => members.value.slice(0, 5))
const restCount = computed(() => Math.max(0, members.value.length - previewMembers.value.length))

/** 角色分布：管理员 N · 编辑者 N · 浏览者 N（只显示不为 0 的） */
const roleStats = computed(() => {
  const stat = {}
  members.value.forEach((item) => {
    if (item.spaceRole) stat[item.spaceRole] = (stat[item.spaceRole] || 0) + 1
  })
  const dotColor = { [SPACE_ROLE.ADMIN]: '#8b5cf6', [SPACE_ROLE.EDITOR]: '#4f46e5', [SPACE_ROLE.VIEWER]: '#9aa1ae' }
  return SPACE_ROLE_OPTIONS.filter((item) => stat[item.value]).map((item) => ({
    value: item.value,
    label: `${item.label} ${stat[item.value]}`,
    dotColor: dotColor[item.value] || '#9aa1ae'
  }))
})

const inviteRoleDesc = computed(
  () =>
    SPACE_INVITE_ROLE_OPTIONS.find((item) => item.value === inviteForm.spaceRole)?.desc || ''
)

const roleDesc = computed(
  () => SPACE_INVITE_ROLE_OPTIONS.find((item) => item.value === roleForm.spaceRole)?.desc || ''
)

const canSubmit = computed(() => Boolean(inviteForm.userId) && Boolean(inviteForm.spaceRole))

function isSelf(record) {
  return String(record.userId) === String(userStore.userId)
}

/** 创建者（admin）不能被移除，角色也不能改 */
function canRemove(record) {
  return record.spaceRole !== SPACE_ROLE.ADMIN
}

function toggle() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(foldKey(props.spaceId), collapsed.value ? '1' : '0')
  } catch (e) {
    /* 隐私模式下写不进去，忽略即可 */
  }
}

async function refresh() {
  try {
    await spaceStore.loadMembers()
  } catch (e) {
    /* 拦截器已提示 */
  }
}

function openInvite() {
  inviteForm.userId = undefined
  inviteForm.spaceRole = SPACE_ROLE.VIEWER
  userOptions.value = []
  keyword.value = ''
  inviteOpen.value = true
}

function onSearchUser(value) {
  keyword.value = value || ''
  if (searchTimer) clearTimeout(searchTimer)
  if (!keyword.value.trim()) {
    userOptions.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const list = await searchUsers(keyword.value.trim())
      userOptions.value = (list || []).map((user) => {
        const name = user.userName || user.userAccount || '未命名用户'
        const account = user.userAccount && user.userAccount !== name ? `（${user.userAccount}）` : ''
        return { value: String(user.id), label: `${name}${account}` }
      })
    } catch (e) {
      userOptions.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

async function handleInvite() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    await spaceStore.inviteMember({
      userId: inviteForm.userId,
      spaceRole: inviteForm.spaceRole
    })
    message.success('成员已加入团队空间')
    inviteOpen.value = false
  } catch (e) {
    /* 拦截器已提示（如「该用户已是空间成员」） */
  } finally {
    submitting.value = false
  }
}

async function handleRemove(record) {
  try {
    await spaceStore.removeMember(record.userId)
    message.success('已移除该成员')
  } catch (e) {
    /* 拦截器已提示 */
  }
}

/** 打开「修改角色」弹窗（空间创建者 admin 的角色后端不接受修改，这里只对普通成员开放） */
function openRole(record) {
  if (!canRemove(record)) return
  roleTarget.value = record
  roleForm.spaceRole = record.spaceRole === SPACE_ROLE.EDITOR ? SPACE_ROLE.EDITOR : SPACE_ROLE.VIEWER
  roleOpen.value = true
}

async function handleUpdateRole() {
  const target = roleTarget.value
  if (!target || !roleForm.spaceRole) return
  const isSelf = String(target.userId) === String(userStore.userId)
  submitting.value = true
  try {
    await spaceStore.updateMemberRole({ userId: target.userId, spaceRole: roleForm.spaceRole })
    message.success('成员角色已更新')
    roleOpen.value = false
    // 改的是我自己的角色：同步空间页上「我的角色」与相关操作按钮
    if (isSelf) {
      try {
        await spaceStore.refreshMyRole()
      } catch (e) {
        /* 角色刷新失败不影响本次修改结果 */
      }
    }
  } catch (e) {
    /* 拦截器已提示（如「空间管理员角色不能被修改」） */
  } finally {
    submitting.value = false
  }
}

// 切换空间时读取该空间自己的折叠状态
watch(
  () => props.spaceId,
  (spaceId) => {
    try {
      collapsed.value = localStorage.getItem(foldKey(spaceId)) === '1'
    } catch (e) {
      collapsed.value = false
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (props.spaceId) refresh()
})
</script>

<style scoped lang="less">
.member-panel {
  padding: 0;
  margin-bottom: 16px;
  overflow: hidden;
}

/* 头部：可点击折叠 */
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.panel-head:hover {
  background: var(--bg);
}

.head-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.head-icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 18px;
  color: var(--brand);
  background: var(--brand-soft);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 620;
}

.member-count {
  min-width: 22px;
  padding: 0 7px;
  height: 20px;
  line-height: 20px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  color: var(--brand);
  background: var(--brand-soft);
}

.view-only-tag {
  margin: 0;
  line-height: 16px;
  font-size: 11px;
}

.panel-sub {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
  max-width: 560px;
}

.head-aside {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  cursor: default;
}

.head-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 头像堆叠 */
.avatar-stack {
  display: flex;
  align-items: center;
}

.stack-avatar {
  margin-left: -8px;
  border: 2px solid var(--surface);
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: #fff;
  font-weight: 600;
}

.stack-avatar:first-child {
  margin-left: 0;
}

.stack-avatar.is-admin {
  background: linear-gradient(135deg, #a78bfa, #7c3aed);
}

.stack-more {
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.role-chips {
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
}

.role-chip .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.collapse-btn {
  padding: 0 8px;
}

/* 表格区 */
.panel-body {
  padding: 0 20px 18px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.user-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: #fff;
  font-weight: 600;
}

.user-avatar.is-admin {
  background: linear-gradient(135deg, #a78bfa, #7c3aed);
}

.user-text {
  min-width: 0;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 550;
}

.mini-tag {
  margin-left: 6px;
  line-height: 16px;
  font-size: 11px;
}

.user-sub,
.cell-sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

/* 空成员 */
.empty-member {
  padding: 18px 0 20px;
  color: var(--text-tertiary);
}

.empty-member p {
  margin: 8px 0 10px;
  font-size: 13px;
}

.empty-icon {
  font-size: 22px;
  color: var(--text-tertiary);
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.role-tip {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-secondary);
}

.role-note {
  margin-top: 16px;
}

@media (max-width: 640px) {
  .panel-head {
    align-items: flex-start;
  }

  .head-aside {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
