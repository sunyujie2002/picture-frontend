<template>
  <div class="page home">
    <!-- 顶部英雄区 -->
    <section class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">发现与收藏每一张好图</h1>
        <p class="hero-desc">
          按名称、分类、标签、格式与主色调组合筛选，快速找到想要的素材。
          这里展示的是已通过审核的公共图片。
        </p>
      </div>

      <div class="hero-search">
        <a-input-search
          v-model:value="query.picName"
          size="large"
          placeholder="搜索图片名称，例如：日落、城市、猫"
          enter-button="搜索"
          allow-clear
          @search="onSearch"
        />
        <div class="hot-row">
          <span class="hot-label">热门格式</span>
          <a
            v-for="f in formatShortcuts"
            :key="f"
            class="hot-chip"
            :class="{ active: query.picFormat === f }"
            @click="toggleFormat(f)"
          >{{ f.toUpperCase() }}</a>
        </div>
      </div>
    </section>

    <!-- 筛选栏 -->
    <section class="filter-bar surface-card">
      <div class="filter-fields">
        <div class="field">
          <label>分类</label>
          <a-select
            v-model:value="query.categoryId"
            placeholder="不限"
            :options="categoryOptions"
            allow-clear
            show-search
            option-filter-prop="label"
            style="width: 100%"
            @change="onFilterChange"
          />
        </div>

        <div class="field">
          <label>标签</label>
          <a-select
            v-model:value="query.tagIds"
            mode="multiple"
            placeholder="不限，可多选"
            :options="tagOptions"
            allow-clear
            style="width: 100%"
            :max-tag-count="1"
            @change="onFilterChange"
          />
        </div>

        <div class="field">
          <label>图片格式</label>
          <a-select
            v-model:value="query.picFormat"
            placeholder="不限"
            :options="PIC_FORMAT_OPTIONS"
            allow-clear
            style="width: 100%"
            @change="onFilterChange"
          />
        </div>

        <div class="field">
          <label>主色调</label>
          <ColorPicker v-model="query.picColor" @change="onFilterChange" />
        </div>

        <div class="field">
          <label>排序</label>
          <a-space-compact style="width: 100%">
            <a-select
              v-model:value="query.sortField"
              :options="SORT_FIELD_OPTIONS"
              style="width: 58%"
              @change="onFilterChange"
            />
            <a-select
              v-model:value="query.sortOrder"
              :options="sortOrderOptions"
              style="width: 42%"
              @change="onFilterChange"
            />
          </a-space-compact>
        </div>
      </div>

      <div class="filter-foot">
        <a-space>
          <a-button v-if="hasFilter" type="link" size="small" @click="resetFilter">
            <template #icon>
              <ReloadOutlined />
            </template>
            重置筛选
          </a-button>
          <span v-else class="text-tertiary filter-hint">共 {{ total }} 张图片</span>
        </a-space>
        <span class="text-tertiary">每页 {{ query.pageSize }} 张</span>
      </div>
    </section>

    <!-- 结果区 -->
    <section class="result">
      <a-spin :spinning="loading" tip="加载中…">
        <!-- 游客也可浏览公共图库；确需登录的接口由后端返回 40100，请求拦截器统一提示并跳转 -->
        <template v-if="pictures.length">
          <!-- 公共图库：一行 4 张，不显示悬浮操作按钮，下载统一在详情页进行 -->
          <PictureGrid :items="pictures" :gap="18" :columns="4">
            <template #default="{ item }">
              <PictureCard
                :picture="item"
                show-time
                :hover-actions="false"
                @click="goDetail"
              />
            </template>
          </PictureGrid>

          <div class="pager">
            <a-pagination
              v-model:current="query.pageNum"
              v-model:pageSize="query.pageSize"
              :total="total"
              :page-size-options="PAGE_SIZE_OPTIONS"
              show-size-changer
              show-quick-jumper
              @change="onPageChange"
            />
          </div>
        </template>

        <a-empty v-else-if="!loading" class="state-box" :description="hasFilter ? '没有符合条件的图片，试试放宽筛选' : '图库还没有图片，去上传第一张吧'">
          <a-space>
            <a-button v-if="hasFilter" @click="resetFilter">重置筛选</a-button>
            <a-button v-if="userStore.isLogin" type="primary" @click="goUpload">上传图片</a-button>
          </a-space>
        </a-empty>
      </a-spin>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ReloadOutlined } from '@ant-design/icons-vue'
import PictureGrid from '@/components/PictureGrid.vue'
import PictureCard from '@/components/PictureCard.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { queryHomePictureList } from '@/api/picture'
import { PIC_FORMAT_OPTIONS, SORT_FIELD_OPTIONS, SORT_ORDER } from '@/constants'
import { useDictStore } from '@/stores/dict'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const dictStore = useDictStore()

const formatShortcuts = ['jpg', 'png', 'webp', 'gif']

const sortOrderOptions = [
  { value: SORT_ORDER.DESC, label: '降序' },
  { value: SORT_ORDER.ASC, label: '升序' }
]

const pictures = ref([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  picName: '',
  categoryId: undefined,
  tagIds: [],
  picFormat: undefined,
  picColor: '',
  pageNum: 1,
  pageSize: 20,
  sortField: 'createTime',
  sortOrder: SORT_ORDER.DESC
})

/**
 * 分类下拉：以字典为准；若当前筛选的分类已不在字典中（被删除但 URL 仍有值），
 * 补一个 #id 选项，避免下拉框显示成空白
 */
const categoryOptions = computed(() => {
  const base = [...dictStore.categoryOptions]
  const id = query.categoryId
  if (id && !base.some((o) => String(o.value) === String(id))) {
    base.unshift({ value: id, label: `分类 #${id}` })
  }
  return base
})

/** 标签下拉：字典为准，结果里出现但未收录的 id 兜底成 #id */
const tagOptions = computed(() => {
  const base = [...dictStore.tagOptions]
  const known = new Set(base.map((o) => String(o.value)))
  const extra = new Set()
  const collect = (t) => {
    if (t === null || t === undefined || t === '') return
    const id = String(t)
    if (!known.has(id)) extra.add(id)
  }
  pictures.value.forEach((p) => {
    if (Array.isArray(p.tags)) p.tags.forEach(collect)
  })
  ;(query.tagIds || []).forEach(collect)
  // 兜底选项的 value 也保持字符串，与字典里的 id 类型一致
  return [...base, ...[...extra].map((v) => ({ value: v, label: `#${v}` }))]
})

const hasFilter = computed(
  () =>
    Boolean(query.picName) ||
    Boolean(query.categoryId) ||
    (query.tagIds && query.tagIds.length > 0) ||
    Boolean(query.picFormat) ||
    Boolean(query.picColor)
)

function buildParams() {
  return {
    picName: query.picName || undefined,
    categoryId: query.categoryId ?? undefined,
    tagIds: query.tagIds?.length ? query.tagIds.map((v) => String(v)) : undefined,
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
    const page = await queryHomePictureList(buildParams())
    pictures.value = page?.records || []
    total.value = Number(page?.total || 0)
  } catch (e) {
    // 错误提示与登录跳转由请求拦截器统一处理，这里只清空列表
    pictures.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

let timer = null
watch(
  () => query.picName,
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      query.pageNum = 1
      fetchList()
    }, 400)
  }
)

function onSearch() {
  query.pageNum = 1
  fetchList()
}

function onFilterChange() {
  query.pageNum = 1
  fetchList()
}

function onPageChange(page, pageSize) {
  query.pageNum = page
  query.pageSize = pageSize
  fetchList()
}

function toggleFormat(format) {
  query.picFormat = query.picFormat === format ? undefined : format
  onFilterChange()
}

function resetFilter() {
  query.picName = ''
  query.categoryId = undefined
  query.tagIds = []
  query.picFormat = undefined
  query.picColor = ''
  query.pageNum = 1
  fetchList()
}

function goDetail(picture) {
  router.push({ path: `/picture/${picture.id}`, state: { picture } })
}

function goUpload() {
  router.push('/upload')
}

onMounted(() => {
  // 分类 / 标签查询已对游客放行，游客也能按分类筛选公共图库
  dictStore.load()
  fetchList()
})
</script>

<style scoped lang="less">
.home {
  padding-top: 24px;
}

.hero {
  position: relative;
  overflow: hidden;
  border: 1px solid #e6e8f3;
  border-radius: 20px;
  background: linear-gradient(130deg, #eef0ff 0%, #f6f1ff 45%, #ffffff 100%);
  padding: 34px 34px 30px;
  margin-bottom: 20px;
}

.hero-copy {
  max-width: 620px;
}

.hero-title {
  margin: 0;
  font-size: 30px;
  font-weight: 680;
  letter-spacing: -0.6px;
  background: linear-gradient(100deg, #312e81 0%, #4f46e5 55%, #7c3aed 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-desc {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: #5c6273;
}

.hero-search {
  margin-top: 22px;
  max-width: 620px;
}

.hot-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hot-label {
  font-size: 12px;
  color: #8b90a0;
}

.hot-chip {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #e2e5f0;
  color: #5c6273;
  cursor: pointer;
  transition: all 0.16s ease;
}

.hot-chip:hover {
  border-color: var(--brand);
  color: var(--brand);
}

.hot-chip.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}

.filter-bar {
  padding: 18px 20px;
  margin-bottom: 20px;
}

.filter-fields {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.filter-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.filter-hint {
  font-size: 13px;
}

.result {
  min-height: 320px;
}

.state-box {
  padding: 72px 0;
}

.pager {
  margin-top: 28px;
  display: flex;
  justify-content: center;
}

@media (max-width: 1080px) {
  .filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 24px 20px;
  }

  .hero-title {
    font-size: 24px;
  }

  .filter-fields {
    grid-template-columns: 1fr;
  }
}
</style>
