<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">上传图片</h1>
      <p class="page-subtitle">
        支持本地文件与网络 URL 两种入库方式；按关键词批量抓取为管理员专属功能。
      </p>
    </div>

    <div class="upload-grid">
      <!-- 左侧：上传区 -->
      <section class="surface-card upload-card">
        <a-tabs v-model:activeKey="activeTab" class="upload-tabs">
          <a-tab-pane key="file" tab="本地上传">
            <a-upload-dragger
              :show-upload-list="false"
              accept="image/*"
              :before-upload="handleFileUpload"
              :disabled="uploading"
            >
              <p class="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p class="ant-upload-text">点击或拖拽图片到此处上传</p>
              <p class="ant-upload-hint">支持 JPG / PNG / WEBP / GIF 等格式，单张不超过 5MB</p>
            </a-upload-dragger>
          </a-tab-pane>

          <a-tab-pane key="url" tab="URL 上传">
            <div class="url-pane">
              <a-input
                v-model:value="fileUrl"
                size="large"
                placeholder="粘贴图片直链，例如 https://example.com/a.jpg"
                allow-clear
                @press-enter="handleUrlUpload"
              />
              <a-button
                type="primary"
                size="large"
                :loading="uploading"
                :disabled="!fileUrl"
                @click="handleUrlUpload"
              >
                抓取并上传
              </a-button>
              <p class="pane-hint">图片会被保存到云端，并自动解析尺寸、体积与主色调。</p>
            </div>
          </a-tab-pane>

          <!-- 批量抓取走 /picture/uploadByBatch，service 层 @AuthCheck 限定管理员 -->
          <a-tab-pane v-if="isAdmin" key="batch" tab="批量抓取">
            <a-alert
              class="batch-tip"
              type="info"
              show-icon
              message="注意事项"
              description="按关键词从图源批量抓取并直接入库到指定分类,无需填写额外信息。抓取数量最大控制在 30 张以内。"
            />
            <a-form style="margin-top: 10px" layout="vertical" :model="batchForm">
              <a-form-item label="搜索关键词">
                <a-input v-model:value="batchForm.searchText" placeholder="例如：城市夜景" allow-clear />
              </a-form-item>
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="抓取数量">
                    <a-input-number v-model:value="batchForm.count" :min="1" :max="100" style="width: 100%" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="入库分类">
                    <a-select
                      v-model:value="batchForm.categoryId"
                      :options="categoryOptions"
                      placeholder="必选，抓取的图片会归入该分类"
                      show-search
                      option-filter-prop="label"
                      style="width: 100%"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
              <a-form-item label="名称前缀">
                <a-input v-model:value="batchForm.prefix" placeholder="可选，将作为图片名称前缀" allow-clear />
              </a-form-item>
              <a-button
                type="primary"
                block
                size="large"
                :loading="batchLoading"
                :disabled="!batchForm.searchText || !batchForm.categoryId"
                @click="handleBatchUpload"
              >
                开始批量抓取
              </a-button>
              <div v-if="batchResult" class="batch-result">{{ batchResult }}</div>
            </a-form>
          </a-tab-pane>
        </a-tabs>
      </section>

      <!-- 右侧：信息完善 -->
      <aside class="surface-card form-card">
        <div class="form-head">
          <h2 class="form-title">完善图片信息</h2>
          <span class="text-tertiary">上传完成后填写，再提交入库</span>
        </div>

        <a-empty v-if="!uploaded" description="请先上传一张图片" class="form-empty" />

        <template v-else>
          <div class="thumb-row">
            <img :src="displayUrl(uploaded)" alt="预览" class="thumb" />
            <div class="thumb-meta">
              <div class="thumb-name ellipsis-1">{{ uploaded.picName }}</div>
              <div class="thumb-sub">
                {{ uploaded.picWidth }} × {{ uploaded.picHeight }} · {{ formatSize(uploaded.picSize) }} ·
                {{ String(uploaded.picFormat || '-').toUpperCase() }}
              </div>
              <div class="thumb-sub">
                <span class="color-dot" :style="{ background: uploadedColor || '#c9cdd8' }" />
                {{ uploadedColor || '未识别主色调' }}
                <span class="server-tag">自动解析</span>
              </div>
            </div>
          </div>

          <a-form layout="vertical" :model="submitForm">
            <a-form-item label="图片名称">
              <a-input v-model:value="submitForm.picName" placeholder="给图片起个名字" :maxlength="64" show-count allow-clear />
            </a-form-item>

            <a-form-item label="简介">
              <a-textarea v-model:value="submitForm.introduction" :rows="3" :maxlength="200" show-count placeholder="补充图片描述" />
            </a-form-item>

            <a-form-item label="分类" required>
              <a-select
                v-model:value="submitForm.categoryId"
                :options="categoryOptions"
                placeholder="请选择分类（公共图库与私有空间都必填）"
                allow-clear
                show-search
                option-filter-prop="label"
                style="width: 100%"
              />
            </a-form-item>

            <a-form-item label="标签">
              <a-select
                v-model:value="submitForm.tagIds"
                mode="multiple"
                :options="tagOptions"
                placeholder="可选，支持多选"
                allow-clear
                style="width: 100%"
                :max-tag-count="3"
              />
              <div class="field-hint">标签由管理员统一维护，需要新标签请先到「管理后台 - 标签管理」创建。</div>
            </a-form-item>

            <a-form-item label="入库范围">
              <a-radio-group v-model:value="scope" button-style="solid">
                <a-radio-button value="public">公共图库（需审核）</a-radio-button>
                <a-radio-button value="private" :disabled="!privateAvailable">
                  私有空间（仅空间可见）
                </a-radio-button>
              </a-radio-group>
              <div v-if="!privateAvailable" class="field-hint">
                还没有可用空间，<a class="inline-link" @click="router.push('/space')">去创建</a>个人空间或团队空间后再上传私有图片。
              </div>
              <div v-else class="field-hint">
                公共图库提交后进入待审核，管理员通过后才会出现在首页；私有空间直接入库，不进审核流程。
              </div>
            </a-form-item>

            <a-form-item v-if="scope === 'private'" label="保存到哪个空间">
              <a-select
                v-model:value="targetSpaceId"
                :options="spaceOptions"
                placeholder="请选择空间"
                style="width: 100%"
              />
              <div class="field-hint">
                个人空间只有自己可见；团队空间对空间成员可见，成员权限由空间管理员分配。
              </div>
            </a-form-item>

            <a-space>
              <a-button type="primary" size="large" :loading="submitting" @click="handleSubmit">提交入库</a-button>
              <a-button size="large" @click="resetAll">重新上传</a-button>
            </a-space>
          </a-form>
        </template>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { InboxOutlined } from '@ant-design/icons-vue'
import { addPicture, uploadPicture, uploadPictureByBatch, uploadPictureByUrl } from '@/api/picture'
import { SPACE_ROLE_PERMISSIONS } from '@/constants'
import { useUserStore } from '@/stores/user'
import { useDictStore } from '@/stores/dict'
import { useSpaceStore } from '@/stores/space'
import { formatSize, normalizeColor, spaceRoleMeta } from '@/utils/format'
import { displayUrl } from '@/utils/image'

const router = useRouter()
const userStore = useUserStore()
const dictStore = useDictStore()
const spaceStore = useSpaceStore()
const isAdmin = computed(() => userStore.isAdmin)

/**
 * 可入库的私有空间：个人空间 + 我的团队空间（我创建的与被邀请加入的）
 * 后端 /picture/private/add 需要 spaceId，不传会兜底落到个人空间，这里显式带上避免歧义。
 * 我在团队空间里是浏览者时该空间不可选（没有上传权限，后端会拒绝）。
 */
const spaceOptions = computed(() => {
  const list = []
  if (spaceStore.personal) {
    list.push({
      value: spaceStore.personal.id,
      label: `个人空间 · ${spaceStore.personal.spaceName || '我的个人空间'}`
    })
  }
  spaceStore.teams.forEach((item) => {
    const canUpload = (SPACE_ROLE_PERMISSIONS[item.spaceRole] || []).includes('picture:add')
    list.push({
      value: item.id,
      label: `团队空间 · ${item.spaceName || '未命名空间'}（${spaceRoleMeta(item.spaceRole).label}）`,
      disabled: !canUpload
    })
  })
  return list
})

const privateAvailable = computed(() => spaceOptions.value.length > 0)
/** 提交时真正带上的 spaceId */
const targetSpaceId = ref('')
const categoryOptions = computed(() => dictStore.categoryOptions)
const tagOptions = computed(() => dictStore.tagOptions)

const activeTab = ref('file')
const uploading = ref(false)
const submitting = ref(false)
const batchLoading = ref(false)
const batchResult = ref('')
const fileUrl = ref('')
const uploaded = ref(null)
const scope = ref('public')

const batchForm = reactive({
  searchText: '',
  count: 10,
  prefix: '',
  categoryId: undefined
})

const submitForm = reactive({
  picName: '',
  introduction: '',
  categoryId: undefined,
  tagIds: []
})

/** 主色调由服务端在上传时解析（SavePictureRequest 已无该字段），这里只做展示 */
const uploadedColor = computed(() => normalizeColor(uploaded.value?.picColor))

// 非管理员时批量抓取页签不存在，避免停留在已隐藏的页签上
watch(isAdmin, (admin) => {
  if (!admin && activeTab.value === 'batch') activeTab.value = 'file'
})

// 确认没有任何空间时，回退到公共图库，避免提交到不存在的空间
watch(privateAvailable, (available) => {
  if (!available && scope.value === 'private') scope.value = 'public'
})

// 空间列表就绪后默认选中第一个可用空间；已选中的空间失效（被删除 / 被移除）时自动回落
watch(
  spaceOptions,
  (list) => {
    const stillValid = list.some((item) => item.value === targetSpaceId.value && !item.disabled)
    if (stillValid) return
    targetSpaceId.value = list.find((item) => !item.disabled)?.value || ''
  },
  { immediate: true }
)

function setUploaded(vo) {
  if (!vo) return
  uploaded.value = vo
  submitForm.picName = vo.picName || ''
  submitForm.categoryId = undefined
  submitForm.tagIds = []
  submitForm.introduction = ''
}

async function handleFileUpload(file) {
  const formData = new FormData()
  formData.append('file', file)
  uploading.value = true
  try {
    const vo = await uploadPicture(formData)
    setUploaded(vo)
    message.success('上传成功，请完善信息后提交')
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    uploading.value = false
  }
  // 阻止 a-upload 自带的上传行为
  return false
}

async function handleUrlUpload() {
  if (!fileUrl.value) return
  uploading.value = true
  try {
    const vo = await uploadPictureByUrl(fileUrl.value)
    setUploaded(vo)
    message.success('上传成功，请完善信息后提交')
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    uploading.value = false
  }
}

async function handleBatchUpload() {
  batchLoading.value = true
  batchResult.value = ''
  try {
    const result = await uploadPictureByBatch({
      searchText: batchForm.searchText,
      count: batchForm.count,
      prefix: batchForm.prefix || undefined,
      categoryId: batchForm.categoryId ?? undefined
    })
    batchResult.value = result || '批量抓取任务已提交'
    message.success('批量抓取完成')
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    batchLoading.value = false
  }
}

async function handleSubmit() {
  if (!uploaded.value) return
  const isPrivate = scope.value === 'private'
  if (!submitForm.categoryId) {
    message.warning('请选择分类')
    return
  }
  if (isPrivate && !targetSpaceId.value) {
    message.warning('请选择要保存到的空间')
    return
  }
  submitting.value = true
  try {
    await addPicture(scope.value, {
      url: uploaded.value.url,
      thumbnailUrl: uploaded.value.thumbnailUrl,
      picName: submitForm.picName || uploaded.value.picName,
      introduction: submitForm.introduction,
      // 私有图片必须带 spaceId（团队空间传团队 id，个人空间也显式带上，别走后端兜底）
      spaceId: isPrivate ? targetSpaceId.value : undefined,
      categoryId: submitForm.categoryId ?? undefined,
      tagIds: (submitForm.tagIds || []).map((v) => String(v)).filter(Boolean),
      picSize: uploaded.value.picSize,
      picWidth: uploaded.value.picWidth,
      picHeight: uploaded.value.picHeight,
      picScale: uploaded.value.picScale,
      picFormat: uploaded.value.picFormat,
      picColor: uploaded.value.picColor
    })
    message.success(isPrivate ? '已保存到所选空间' : '已提交至公共图库，等待审核')
    // 回空间页时定位到刚入库的那个空间，避免停在另一个空间上以为没传成功
    if (isPrivate) {
      const team = spaceStore.teams.find((item) => item.id === targetSpaceId.value)
      if (team) spaceStore.setCurrentTeam(team.id, userStore.userId)
      else spaceStore.setCurrent('personal', userStore.userId)
    }
    resetAll()
    // 公共图库回「我的上传」看审核状态，私有图回空间页（概览 + 私有图片列表）
    router.push(isPrivate ? '/space' : '/my')
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  dictStore.load()
  // 探测个人空间与团队空间，决定「私有空间」是否可选以及可入库的空间列表
  if (!userStore.userId) await userStore.fetchUserInfo()
  try {
    await spaceStore.load(userStore.userId)
  } catch (e) {
    /* 探测失败不阻塞上传，提交时再由后端兜底校验 */
  }
})

function resetAll() {
  uploaded.value = null
  fileUrl.value = ''
  batchResult.value = ''
  Object.assign(submitForm, {
    picName: '',
    introduction: '',
    categoryId: undefined,
    tagIds: []
  })
}
</script>

<style scoped lang="less">
.upload-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 0.85fr);
  gap: 20px;
  align-items: start;
}

.upload-card {
  padding: 8px 22px 24px;
}

.upload-tabs {
  min-height: 320px;
}

.url-pane {
  padding: 10px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pane-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.batch-tip {
  margin-top: 4px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.inline-link {
  color: var(--brand);
  cursor: pointer;
}

.batch-result {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.form-card {
  padding: 22px;
}

.form-head {
  margin-bottom: 16px;
}

.form-title {
  margin: 0;
  font-size: 17px;
  font-weight: 620;
}

.form-empty {
  padding: 60px 0;
}

.thumb-row {
  display: flex;
  gap: 14px;
  padding: 12px;
  margin-bottom: 18px;
  border-radius: var(--radius);
  background: #f7f8fc;
  border: 1px solid var(--border);
}

.thumb {
  width: 84px;
  height: 84px;
  border-radius: 10px;
  object-fit: cover;
  background: #eceef4;
  flex-shrink: 0;
}

.thumb-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.thumb-name {
  font-weight: 600;
}

.thumb-sub {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.server-tag {
  margin-left: 2px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  color: var(--text-tertiary);
  background: var(--bg);
  border: 1px solid var(--border);
}

@media (max-width: 980px) {
  .upload-grid {
    grid-template-columns: 1fr;
  }
}
</style>
