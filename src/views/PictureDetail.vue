<template>
  <div class="page detail">
    <div class="crumb">
      <a @click="goBack">
        <ArrowLeftOutlined />
        返回图库
      </a>
    </div>

    <a-spin :spinning="loading">
      <div v-if="picture" class="detail-grid">
        <!-- 左侧预览 -->
        <section class="preview surface-card">
          <div class="preview-stage">
            <!-- 用 canvas 渲染：页面上没有 <img src>，右键另存为 / 复制图片地址 / 新标签打开全部失效 -->
            <CanvasPicture v-if="cover" :src="cover" :alt="picture.picName || '图片'" :max-height-vh="62" />
            <a-empty v-else description="图片加载失败" />
          </div>
          <div class="preview-actions">
            <a-button type="primary" @click="handleDownload(picture)">
              <template #icon>
                <DownloadOutlined />
              </template>
              下载原图
            </a-button>
            <a-button @click="handleCopyUrl">
              <template #icon>
                <LinkOutlined />
              </template>
              复制链接
            </a-button>
            <a-button @click="runSearch">
              <template #icon>
                <SearchOutlined />
              </template>
              以图搜图
            </a-button>
          </div>
        </section>

        <!-- 右侧信息 -->
        <aside class="info surface-card">
          <div class="info-head">
            <h1 class="info-title">{{ picture.picName || '未命名图片' }}</h1>
            <div class="info-tags">
              <a-tag v-if="picture.picFormat" color="blue">{{ String(picture.picFormat).toUpperCase() }}</a-tag>
              <a-tag v-if="picture.categoryId" color="purple">{{ dictStore.categoryName(picture.categoryId) }}</a-tag>
              <a-tag v-if="userStore.isAdmin && picture.reviewStatus !== undefined" :color="reviewMeta(picture.reviewStatus).color">
                {{ reviewMeta(picture.reviewStatus).label }}
              </a-tag>
            </div>
          </div>

          <p class="info-intro">{{ picture.introduction || '暂无简介' }}</p>

          <a-descriptions :column="1" size="small" bordered class="info-desc">
            <a-descriptions-item label="尺寸">{{ picture.picWidth || '-' }} × {{ picture.picHeight || '-' }}</a-descriptions-item>
            <a-descriptions-item label="宽高比">{{ formatScale(picture.picScale) }}</a-descriptions-item>
            <a-descriptions-item label="体积">{{ formatSize(picture.picSize) }}</a-descriptions-item>
            <a-descriptions-item label="格式">{{ picture.picFormat || '-' }}</a-descriptions-item>
            <a-descriptions-item label="主色调">
              <span class="color-cell">
                <span class="color-dot" :style="{ background: color || '#c9cdd8' }" />
                {{ color || '未识别' }}
              </span>
            </a-descriptions-item>
            <a-descriptions-item label="上传者">{{ picture.userName || '-' }}</a-descriptions-item>
            <a-descriptions-item label="创建时间">{{ formatTime(picture.createTime) }}</a-descriptions-item>
          </a-descriptions>

          <div v-if="tagList.length" class="tag-block">
            <div class="block-label">标签</div>
            <div class="tag-list">
              <a-tag v-for="t in tagLabels" :key="t">{{ t }}</a-tag>
            </div>
          </div>

          <!-- <div v-if="userStore.isAdmin" class="review-block">
            <div class="block-label">审核操作</div>
            <a-space wrap>
              <a-button size="small" type="primary" @click="submitReview(1)">通过</a-button>
              <a-button size="small" danger @click="submitReview(2)">拒绝</a-button>
            </a-space>
            <a-input
              v-model:value="reviewMessage"
              class="review-input"
              placeholder="审核意见（拒绝时建议填写原因）"
              :maxlength="120"
            />
          </div>

          <div v-if="canEdit" class="owner-block">
            <a-space>
              <a-button @click="openEdit">编辑信息</a-button>
              <a-popconfirm
                title="确认删除这张图片？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDelete"
              >
                <a-button danger>删除图片</a-button>
              </a-popconfirm>
            </a-space>
          </div> -->
        </aside>
      </div>
    </a-spin>

    <!-- 以图搜图结果 -->
    <section v-if="similarVisible" class="similar surface-card">
      <div class="similar-head">
        <h2 class="similar-title">相似推荐</h2>
      </div>

      <a-spin :spinning="searching">
        <a-empty v-if="!searching && !similarList.length" description="没有找到相似的图片" />
        <PictureGrid v-else :items="similarList" :gap="16">
          <template #default="{ item }">
            <!-- 相似图片同样是公共展示：不挂悬浮操作按钮，下载走各自详情页的「下载原图」 -->
            <PictureCard :picture="item" show-time :hover-actions="false" @click="goDetail" />
          </template>
        </PictureGrid>
      </a-spin>
    </section>

    <PictureEditModal
      v-model:open="editOpen"
      :picture="picture"
      :submitting="submitting"
      @submit="handleEditSubmit"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  LinkOutlined,
  SearchOutlined
} from '@ant-design/icons-vue'
import PictureEditModal from '@/components/PictureEditModal.vue'
import CanvasPicture from '@/components/CanvasPicture.vue'
import PictureGrid from '@/components/PictureGrid.vue'
import PictureCard from '@/components/PictureCard.vue'
import {
  deletePicture,
  queryPictureById,
  reviewPicture,
  searchPictureByPicture,
  updatePicture
} from '@/api/picture'
import {
  copyText,
  formatScale,
  formatSize,
  formatTime,
  normalizeColor,
  reviewMeta
} from '@/utils/format'
import { resolveImageUrl } from '@/utils/image'
import { REVIEW_STATUS } from '@/constants'
import { useUserStore } from '@/stores/user'
import { useDictStore } from '@/stores/dict'
import { useDownloadStore } from '@/stores/download'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const dictStore = useDictStore()
const downloadStore = useDownloadStore()

const picture = ref(null)
const loading = ref(false)
const reviewMessage = ref('')
const editOpen = ref(false)
const submitting = ref(false)
const similarList = ref([])
const searching = ref(false)
const similarVisible = ref(false)

// 雪花 ID 超过 JS 安全整数范围，全程保持字符串，不做 Number 转换
const pictureId = computed(() => String(route.params.id ?? ''))

// 详情页展示原图；缩略图仅作为兜底
const cover = computed(() => resolveImageUrl(picture.value?.url || picture.value?.thumbnailUrl))
const color = computed(() => normalizeColor(picture.value?.picColor))
const tagList = computed(() => (Array.isArray(picture.value?.tags) ? picture.value.tags : []))
const tagLabels = computed(() => dictStore.tagLabels(tagList.value))

// 管理员可编辑全部；普通用户仅能编辑自己上传的图片
const canEdit = computed(() => {
  if (!userStore.isLogin || !picture.value) return false
  return userStore.isAdmin || picture.value.userId === userStore.userId
})

/**
 * 详情回显策略：
 * 优先使用列表页携带的对象（history.state.picture）——后端 queryList 已返回全部字段，
 * 无需再调 byId。仅当直链 / 刷新 / 分享进入（无携带对象）时，才用 byId 兜底，
 * 但 byId 只对「审核通过」的图片可用，待审核 / 未通过的图片在此场景下无法单独查看。
 */
async function fetchDetail() {
  loading.value = true
  try {
    const fromList = history.state && history.state.picture ? history.state.picture : null
    if (fromList) {
      picture.value = fromList
      return
    }
    picture.value = await queryPictureById(pictureId.value)
  } catch (e) {
    picture.value = null
  } finally {
    loading.value = false
  }
}

async function submitReview(status) {
  try {
    await reviewPicture({
      pictureId: pictureId.value,
      reviewStatus: status,
      reviewMessage: status === REVIEW_STATUS.REJECT ? reviewMessage.value || '不符合收录标准' : reviewMessage.value || '内容合规'
    })
    message.success(status === REVIEW_STATUS.PASS ? '已通过审核' : '已拒绝该图片')
    reviewMessage.value = ''
    await fetchDetail()
  } catch (e) {
    /* 拦截器已提示 */
  }
}

function openEdit() {
  editOpen.value = true
}

async function handleEditSubmit(values) {
  submitting.value = true
  try {
    await updatePicture(values)
    message.success('图片信息已更新')
    editOpen.value = false
    await fetchDetail()
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  try {
    await deletePicture(pictureId.value)
    message.success('图片已删除')
    router.push('/')
  } catch (e) {
    /* 拦截器已提示 */
  }
}

// 下载交给全局下载面板：点击即刻出现进度条，可并行多个、可取消，
// 成功 / 失败状态由面板展示，这里不再重复弹 message
function handleDownload(pic) {
  downloadStore.start(pic || picture.value)
}

async function handleCopyUrl() {
  const pic = picture.value
  if (!pic) return
  // 复制的是「分享文案 + 当前页面地址」，不是图片直链：
  // 原图地址（COS 直链）任何人拿到都能直接下载，绕过后端的登录校验，
  // 下载只允许走 /picture/download 接口，所以不把图片地址给用户
  const name = pic.picName || '未命名图片'
  // 分享链接固定带上 from=share：详情页据此识别「从分享进来」，
  // 此时没有站内上级页面，「返回图库」直接回首页而不是退到浏览器空白页
  const shareUrl = `${window.location.origin}/picture/${pic.id}?from=share`
  const text = `你的好友给你分享了壁纸《${name}》，快来使用看看吧 ${shareUrl}`
  const ok = await copyText(text)
  message.success(ok ? '分享内容已复制' : '复制失败，请手动复制')
}

function goBack() {
  // ① 分享链接打开（URL 带 from=share）：没有站内上级页面，回图库首页；
  // ② 其余一律返回上一级页面——图片管理 / 空间 / 首页等列表页跳进来的都回上级
  // （不要用 history.state / history.length 做判断，某些环境下不可靠，会误跳首页）
  if (route.query.from === 'share') {
    router.push('/')
  } else {
    router.back()
  }
}

async function runSearch() {
  if (!pictureId.value) return
  similarVisible.value = true
  searching.value = true
  try {
    similarList.value = (await searchPictureByPicture(pictureId.value)) || []
  } catch (e) {
    similarList.value = []
  } finally {
    searching.value = false
  }
}

function goDetail(pic) {
  router.push({ path: `/picture/${pic.id}`, state: { picture: pic } })
}

// 防扒图只保留 canvas 渲染这一层（见 components/CanvasPicture.vue）：
// 页面上没有 <img src>，右键另存为 / 复制图片地址 / 新标签打开图片都没有入口。
// 不再禁用右键菜单、不再拦 F12：那会挡住"复制链接""新标签打开"这类正常使用，
// 而 canvas 已经让针对图片的右键项失效，禁用整个菜单属于误伤。

onMounted(async () => {
  await fetchDetail()
  if (route.query.sim === '1') {
    runSearch()
  }
})
</script>

<style scoped lang="less">
.crumb {
  margin-bottom: 14px;
  font-size: 13px;
}

.crumb a {
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.crumb a:hover {
  color: var(--brand);
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr);
  gap: 20px;
  align-items: start;
}

.preview {
  padding: 20px;
}

.preview-stage {
  border-radius: var(--radius);
  background: var(--checker);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  padding: 16px;
  min-height: 320px;
}

/* 主图改用 CanvasPicture（canvas 渲染）后不再需要 .stage-img：
   页面上不存在 <img>，右键另存为 / 复制图片地址 / 新标签打开都没有入口 */

.preview-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.info {
  padding: 22px;
  position: sticky;
  top: 84px;
}

.info-title {
  margin: 0;
  font-size: 21px;
  font-weight: 650;
  letter-spacing: -0.2px;
  word-break: break-all;
}

.info-tags {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.info-intro {
  margin: 14px 0 18px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.info-desc {
  font-size: 13px;
}

.color-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.block-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.tag-block {
  margin-top: 18px;
}

.tag-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.review-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.review-input {
  margin-top: 10px;
}

.owner-block {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.similar {
  margin-top: 24px;
  padding: 22px;
}

.similar-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}

.similar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 620;
}

@media (max-width: 980px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .info {
    position: static;
  }
}
</style>
