<template>
  <div class="page">
    <div class="page-head head-row">
      <div>
        <h1 class="page-title">我的空间</h1>
        <p class="page-subtitle">
          个人空间存私有图片；团队空间可邀请成员协作，按角色分配查看与编辑权限。
        </p>
      </div>
      <a-space v-if="spaceStore.canUpload">
        <a-button @click="refresh">
          <template #icon>
            <ReloadOutlined />
          </template>
          刷新
        </a-button>
        <a-button type="primary" @click="router.push('/upload')">
          <template #icon>
            <CloudUploadOutlined />
          </template>
          上传图片
        </a-button>
      </a-space>
    </div>

    <!-- 空间切换：个人空间 + 团队空间（我创建的 / 我加入的） -->
    <div class="switch-bar">
      <a-select
        :value="spaceStore.currentKey"
        :options="spaceStore.switchOptions"
        style="min-width: 240px"
        @change="handleSwitch"
      />
      <span class="switch-hint">{{ switchHint }}</span>
      <a-button v-if="!spaceStore.hasOwnTeam" size="small" @click="startCreateTeam">
        <template #icon>
          <PlusOutlined />
        </template>
        创建我的团队空间
      </a-button>
      <a-button v-if="spaceStore.hasCurrent" size="small" @click="goAnalysis">
        <template #icon>
          <BarChartOutlined />
        </template>
        数据分析
      </a-button>
    </div>

    <a-spin :spinning="checking">
      <!-- 探测失败 -->
      <section v-if="loadError" class="surface-card retry-card">
        <div class="create-inner">
          <div class="guide-icon muted">
            <ReloadOutlined />
          </div>
          <h2 class="card-title">暂时无法确认空间状态</h2>
          <p class="create-desc">请确认已登录，然后重新检测。</p>
          <a-button size="large" @click="refresh">重新检测</a-button>
        </div>
      </section>

      <!-- 还没创建：引导创建当前选中的空间 -->
      <section v-else-if="showCreate" class="surface-card create-card">
        <div class="create-inner">
          <div class="guide-icon">
            <DatabaseOutlined />
          </div>
          <h2 class="card-title">创建{{ createLabel }}</h2>
          <p class="create-desc">{{ createDesc }}</p>

          <a-form layout="vertical" :model="createForm" class="create-form" @submit.prevent="handleCreate">
            <a-form-item label="空间名称">
              <a-input
                v-model:value="createForm.spaceName"
                :placeholder="namePlaceholder"
                :maxlength="32"
                allow-clear
                @press-enter="handleCreate"
              />
              <div class="field-hint">{{ createHint }}</div>
            </a-form-item>

            <div class="level-note">
              <span class="level-label">空间版本</span>
              <a-tag :color="spaceLevelMeta(0).color">{{ spaceLevelMeta(0).label }}</a-tag>
              <span class="level-hint">
                创建时固定为普通版（{{ formatSize(SPACE_LEVEL_CAPACITY[0]) }}），后续可付费升级到更大容量。
              </span>
            </div>

            <a-button type="primary" block size="large" :loading="creating" @click="handleCreate">
              创建{{ createLabel }}
            </a-button>
          </a-form>
        </div>
      </section>

      <!-- 已创建：概览（团队空间额外展示成员面板）+ 图片列表 -->
      <template v-else-if="spaceStore.hasCurrent">
        <section class="surface-card overview">
          <div class="overview-main">
            <div class="title-row">
              <span class="space-name">{{ spaceStore.currentName || defaultName }}</span>
              <a-tag :color="spaceTypeMeta(spaceStore.currentType).color">
                {{ spaceTypeMeta(spaceStore.currentType).label }}
              </a-tag>
              <a-tag :color="spaceLevelMeta(spaceStore.currentLevel).color">
                {{ spaceLevelMeta(spaceStore.currentLevel).label }}
              </a-tag>
              <a-tag v-if="spaceStore.isTeam" :color="spaceRoleMeta(spaceStore.role).color">
                我是{{ spaceRoleMeta(spaceStore.role).label }}
              </a-tag>
            </div>
            <div class="space-meta">
              <span v-if="spaceStore.current?.createTime">
                创建于 {{ formatTime(spaceStore.current.createTime) }}
              </span>
              <span v-if="spaceStore.isTeam && spaceStore.current?.userName">
                · 由 {{ spaceStore.current.userName }} 创建
              </span>
              <span v-if="!spaceStore.current?.createTime">
                {{ spaceStore.isTeam ? '团队共享 · 成员按角色访问' : '私有图库 · 仅自己可见' }}
              </span>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">已用容量</span>
                <span class="meta-value">{{ formatSize(spaceStore.current?.totalSize) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">剩余容量</span>
                <span class="meta-value">{{ formatSize(spaceStore.freeSize, 3) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">总容量</span>
                <span class="meta-value">{{ formatSize(spaceStore.current?.maxSize, 3) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">已存图片</span>
                <span class="meta-value">{{ spaceStore.current?.totalCount ?? 0 }} 张</span>
              </div>
            </div>

            <div class="overview-actions">
              <a-button v-if="spaceStore.canManageSpace" @click="openRename">
                <template #icon>
                  <EditOutlined />
                </template>
                修改名称
              </a-button>
              <a-button v-if="spaceStore.canManageSpace" type="primary" @click="openUpgrade">
                <template #icon>
                  <RocketOutlined />
                </template>
                升级空间
              </a-button>
            </div>
          </div>

          <div class="overview-chart">
            <a-progress
              type="circle"
              :percent="spaceStore.freePercent"
              :size="148"
              :stroke-width="10"
              :stroke-color="progressColor"
            >
              <!-- ant-design-vue 的 format 插槽按位置参数传入 percent，不能解构 -->
              <template #format="percent">
                <span class="chart-percent">{{ percent }}%</span>
                <span class="chart-label">剩余</span>
              </template>
            </a-progress>
          </div>
        </section>

        <a-alert
          v-if="spaceStore.isTeam && !spaceStore.canUpload"
          class="role-tip"
          type="info"
          show-icon
          message="你在该空间的角色是浏览者"
          description="可以浏览空间内的图片，上传与修改需要编辑者及以上权限，如需调整请联系空间管理员。"
        />

        <!-- 所有成员都能看到成员列表，邀请 / 改角色 / 移除只在创建者视角出现 -->
        <SpaceMemberPanel v-if="spaceStore.isTeam && spaceStore.hasCurrent" :space-id="spaceStore.currentId" />

        <PictureManageList
          :key="spaceStore.currentId"
          :fetcher="queryPrivatePictureList"
          :extra-params="{ spaceId: spaceStore.currentId }"
          default-view="card"
          empty-title="空间里还没有图片"
          :enable-canvas-edit="spaceStore.canEdit"
          :collaborative="spaceStore.isTeam"
          @changed="onListChanged"
        >
          <template #empty-action>
            <a-button v-if="spaceStore.canUpload" type="primary" @click="router.push('/upload')">
              {{ spaceStore.isTeam ? '上传到团队空间' : '上传私有图片' }}
            </a-button>
          </template>
        </PictureManageList>
      </template>
    </a-spin>

    <!-- 修改名称 -->
    <a-modal
      v-model:open="renameOpen"
      title="修改空间名称"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="submitting"
      @ok="handleRename"
    >
      <a-form layout="vertical">
        <a-form-item label="空间名称">
          <a-input
            v-model:value="renameForm.spaceName"
            placeholder="请输入空间名称"
            :maxlength="32"
            allow-clear
          />
        </a-form-item>
      </a-form>
      <a-alert
        v-if="!spaceStore.currentId"
        type="warning"
        show-icon
        message="暂时取不到你的空间信息"
        description="没能确认你的空间，暂时无法改名。请返回空间页重新检测，确认空间存在后再试。"
      />
    </a-modal>

    <!-- 付费升级 -->
    <a-modal
      v-model:open="upgradeOpen"
      title="升级空间版本"
      ok-text="确认升级"
      cancel-text="取消"
      :confirm-loading="submitting"
      :ok-button-props="{ disabled: !canUpgrade }"
      @ok="handleUpgrade"
    >
      <p class="upgrade-tip">
        当前为
        <a-tag :color="spaceLevelMeta(spaceStore.currentLevel).color">
          {{ spaceLevelMeta(spaceStore.currentLevel).label }}
        </a-tag>
        总容量 {{ formatSize(spaceStore.current?.maxSize, 3) }}，已使用
        {{ formatSize(spaceStore.current?.totalSize) }}。
      </p>

      <div class="plan-list">
        <div
          v-for="plan in SPACE_LEVEL_OPTIONS"
          :key="plan.value"
          class="plan-card"
          :class="{
            current: plan.value === spaceStore.currentLevel,
            active: plan.value === upgradeForm.spaceLevel,
            disabled: plan.value < spaceStore.currentLevel
          }"
          @click="pickPlan(plan)"
        >
          <div class="plan-head">
            <span class="plan-name">{{ plan.label }}</span>
            <a-tag v-if="plan.value === spaceStore.currentLevel" color="green">当前版本</a-tag>
          </div>
          <div class="plan-size">{{ formatSize(plan.size) }}</div>
          <div class="plan-foot">
            {{ plan.value < spaceStore.currentLevel ? '低于当前版本' : '总容量' }}
          </div>
        </div>
      </div>

      <a-alert
        class="upgrade-note"
        type="info"
        show-icon
        message="升级说明"
        description="升级会提高空间总容量，原图片不受影响。"
      />
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  BarChartOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined
} from '@ant-design/icons-vue'
import PictureManageList from '@/components/PictureManageList.vue'
import SpaceMemberPanel from '@/components/SpaceMemberPanel.vue'
import { queryPrivatePictureList } from '@/api/picture'
import { SPACE_LEVEL_CAPACITY, SPACE_LEVEL_OPTIONS, SPACE_TYPE } from '@/constants'
import { useSpaceStore } from '@/stores/space'
import { useUserStore } from '@/stores/user'
import { formatSize, formatTime, spaceLevelMeta, spaceRoleMeta, spaceTypeMeta } from '@/utils/format'

const router = useRouter()
const userStore = useUserStore()
const spaceStore = useSpaceStore()

const checking = ref(false)
const loadError = ref(false)
const creating = ref(false)
const submitting = ref(false)

const createForm = reactive({ spaceName: '' })
/** 正在创建的视图：'' = 跟随切换器，'personal' / 'team' = 显式打开创建表单 */
const createMode = ref('')
const renameOpen = ref(false)
const renameForm = reactive({ spaceName: '' })
const upgradeOpen = ref(false)
const upgradeForm = reactive({ spaceLevel: 1 })

/** 创建表单对应的空间类型 */
const createType = computed(() => {
  if (createMode.value === 'team') return SPACE_TYPE.TEAM
  if (createMode.value === 'personal') return SPACE_TYPE.PERSONAL
  return spaceStore.currentType
})

const createLabel = computed(() => spaceTypeMeta(createType.value).label)

const isCreateTeam = computed(() => createType.value === SPACE_TYPE.TEAM)

/** 当前选中的空间不存在，或显式点了「创建我的团队空间」时展示创建表单 */
const showCreate = computed(
  () => Boolean(createMode.value) || (spaceStore.probed && !spaceStore.hasCurrent)
)

const defaultName = computed(() => (spaceStore.isTeam ? '我的团队空间' : '我的个人空间'))

const switchHint = computed(() =>
  spaceStore.hasOwnTeam
    ? '被邀请加入的团队空间也会出现在这里'
    : '创建自己的团队空间后，就可以邀请成员协作了'
)

const createDesc = computed(() =>
  isCreateTeam.value
    ? '团队空间用于多人协作：创建后你就是空间管理员，可以邀请成员加入，并按角色分配查看、上传与修改权限。'
    : '空间是私有图库的容器。创建后即可在上传时选择「私有空间」，图片只对你自己可见，也不会进入公共审核流程。'
)

const namePlaceholder = computed(() => (isCreateTeam.value ? '例如：设计组素材库' : '例如：我的素材库'))

const createHint = computed(() =>
  isCreateTeam.value
    ? '留空则自动命名为「你的昵称的团队空间」。每个用户仅能创建一个团队空间。'
    : '留空则自动命名为「你的昵称的个人空间」。每个用户仅能创建一个个人空间。'
)

const progressColor = computed(() => {
  const free = spaceStore.freePercent
  if (free <= 10) return '#e5484d'
  if (free <= 30) return '#f5a524'
  return '#4f46e5'
})

const canUpgrade = computed(
  () => Boolean(spaceStore.currentId) && upgradeForm.spaceLevel > spaceStore.currentLevel
)

async function refresh() {
  checking.value = true
  loadError.value = false
  try {
    // 空间探测按用户维度缓存，先确保拿到 userId
    if (!userStore.userId) await userStore.fetchUserInfo()
    await spaceStore.load(userStore.userId, true)
    await syncMembers()
  } catch (e) {
    loadError.value = true
  } finally {
    checking.value = false
  }
}

/** 团队空间才需要成员列表；切回个人空间时清空，避免串空间展示 */
async function syncMembers() {
  if (spaceStore.isTeam && spaceStore.hasCurrent) {
    try {
      await spaceStore.loadMembers()
    } catch (e) {
      /* 拦截器已提示 */
    }
  } else {
    spaceStore.clearMembers()
  }
}

function handleSwitch(value) {
  createMode.value = ''
  spaceStore.setCurrent(value, userStore.userId)
  syncMembers()
}

/** 跳到数据分析页，默认分析当前正在查看的空间 */
function goAnalysis() {
  const spaceId = spaceStore.currentId
  router.push(spaceId ? { path: '/space/analysis', query: { spaceId } } : '/space/analysis')
}

/** 打开「创建团队空间」表单（此时切换器仍停在个人空间，创建成功后会自动切过去） */
function startCreateTeam() {
  createForm.spaceName = ''
  createMode.value = 'team'
}

async function handleCreate() {
  creating.value = true
  try {
    // 后端 SaveSpaceRequest 新增时不能带 spaceId，等级固定普通版，这里只提交名称与类型
    await spaceStore.create(userStore.userId, {
      spaceName: createForm.spaceName.trim() || undefined,
      spaceType: createType.value
    })
    message.success(`${createLabel.value}创建成功`)
    createForm.spaceName = ''
    createMode.value = ''
    await syncMembers()
  } catch (e) {
    /* 拦截器已提示（如「每个用户仅能创建一个团队空间」） */
  } finally {
    creating.value = false
  }
}

function openRename() {
  renameForm.spaceName = spaceStore.currentName || ''
  renameOpen.value = true
}

async function handleRename() {
  const name = renameForm.spaceName.trim()
  if (!name) {
    message.warning('请输入空间名称')
    return
  }
  submitting.value = true
  try {
    await spaceStore.rename(userStore.userId, name)
    message.success('空间名称已更新')
    renameOpen.value = false
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

function openUpgrade() {
  upgradeForm.spaceLevel = spaceStore.currentLevel < 2 ? spaceStore.currentLevel + 1 : 2
  upgradeOpen.value = true
}

function pickPlan(plan) {
  if (plan.value <= spaceStore.currentLevel) return
  upgradeForm.spaceLevel = plan.value
}

async function handleUpgrade() {
  if (!canUpgrade.value) return
  submitting.value = true
  try {
    await spaceStore.upgrade(userStore.userId, upgradeForm.spaceLevel)
    message.success(`已升级为${spaceLevelMeta(upgradeForm.spaceLevel).label}`)
    upgradeOpen.value = false
    await refresh()
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

/**
 * 私有图片被增删改（容量可能变化）后同步刷新空间概览。
 * 仅在列表真正发生改动时触发，普通查询 / 翻页不会回调，避免多余的 queryById。
 */
function onListChanged() {
  spaceStore.refreshUsage(userStore.userId)
}

onMounted(refresh)
</script>

<style scoped lang="less">
.head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.switch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.switch-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.create-card,
.retry-card {
  padding: 48px 28px;
}

.create-inner {
  max-width: 480px;
  margin: 0 auto;
  text-align: center;
}

.guide-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 16px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-size: 26px;
  color: #fff;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 55%, #7c3aed 100%);
  box-shadow: 0 10px 24px -10px rgba(79, 70, 229, 0.6);
}

.guide-icon.muted {
  background: linear-gradient(135deg, #9aa1ae 0%, #6b7280 100%);
  box-shadow: none;
}

.card-title {
  margin: 0 0 8px;
  font-size: 19px;
  font-weight: 620;
}

.create-desc {
  margin: 0 0 22px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.create-form {
  text-align: left;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.level-note {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  margin-bottom: 18px;
  border-radius: var(--radius);
  background: var(--bg);
}

.level-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.level-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 已创建空间：概览 */
.overview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  flex-wrap: wrap;
  padding: 24px 26px;
  margin-bottom: 16px;
}

.overview-main {
  flex: 1 1 320px;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.space-name {
  font-size: 20px;
  font-weight: 620;
}

.space-meta {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-grid {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.meta-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.overview-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.overview-chart {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
}

.chart-percent {
  display: block;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.2;
}

.chart-label {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.role-tip {
  margin-bottom: 16px;
}

/* 升级方案 */
.upgrade-tip {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-secondary);
}

.plan-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.plan-card {
  padding: 14px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.18s ease;
}

.plan-card:hover:not(.disabled):not(.current) {
  border-color: #b9bbf3;
}

.plan-card.active {
  border-color: var(--brand);
  background: var(--brand-soft);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.plan-card.current {
  cursor: default;
  background: var(--bg);
}

.plan-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plan-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.plan-name {
  font-size: 14px;
  font-weight: 600;
}

.plan-size {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 650;
  color: var(--brand);
}

.plan-foot {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.upgrade-note {
  margin-top: 16px;
}

@media (max-width: 640px) {
  .overview {
    gap: 20px;
  }

  .plan-list {
    grid-template-columns: 1fr;
  }
}
</style>
