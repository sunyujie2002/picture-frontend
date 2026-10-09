<template>
  <div class="pic-card" :class="{ 'is-checked': checked }" @click="emit('click', picture)">
    <div class="thumb" :style="thumbStyle">
      <img
        v-if="cover"
        :src="cover"
        :alt="picture.picName || '图片'"
        loading="lazy"
        @error="onError"
      />
      <div v-else class="thumb-fallback">
        <PictureOutlined />
      </div>

      <!-- 左上角勾选框（批量操作场景） -->
      <label v-if="selectable" class="check" @click.stop>
        <a-checkbox :checked="checked" @change="onCheckChange" />
      </label>

      <!-- 右下角主色调标识 -->
      <span v-if="color" class="color-chip" :style="{ background: color }" :title="`主色调 ${color}`" />

      <div class="overlay" @click.stop>
        <div class="overlay-actions">
          <a-tooltip title="查看详情">
            <button class="act" @click="emit('detail', picture)">
              <EyeOutlined />
            </button>
          </a-tooltip>
          <a-tooltip title="下载">
            <button class="act" @click="emit('download', picture)">
              <DownloadOutlined />
            </button>
          </a-tooltip>
          <template v-if="editable">
            <a-tooltip title="编辑">
              <button class="act" @click="emit('edit', picture)">
                <EditOutlined />
              </button>
            </a-tooltip>
            <a-tooltip title="删除">
              <button class="act danger" @click="emit('delete', picture)">
                <DeleteOutlined />
              </button>
            </a-tooltip>
          </template>
        </div>
      </div>

      <a-tag v-if="reviewTag" :color="reviewTag.color" class="review-tag">{{ reviewTag.label }}</a-tag>
    </div>

    <div class="meta">
      <div class="title-row">
        <span class="name ellipsis-1" :title="picture.picName">{{ picture.picName || '未命名图片' }}</span>
        <span v-if="picture.picFormat" class="format">{{ String(picture.picFormat).toUpperCase() }}</span>
      </div>
      <div class="sub-row">
        <span>{{ picture.picWidth || '-' }} × {{ picture.picHeight || '-' }}</span>
        <span class="sep">·</span>
        <span>{{ formatSize(picture.picSize) }}</span>
      </div>
      <div v-if="showTime" class="time-row">
        <span>{{ formatTime(picture.createTime) }}</span>
        <span v-if="categoryLabel" class="sep">·</span>
        <span v-if="categoryLabel">{{ categoryLabel }}</span>
      </div>
      <div v-if="tagLabels.length" class="tag-row">
        <span v-for="t in tagLabels" :key="t" class="mini-tag">{{ t }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PictureOutlined
} from '@ant-design/icons-vue'
import { useDictStore } from '@/stores/dict'
import { formatSize, formatTime, normalizeColor, reviewMeta } from '@/utils/format'
import { resolveImageUrl } from '@/utils/image'

const dictStore = useDictStore()

const props = defineProps({
  picture: { type: Object, required: true },
  selectable: { type: Boolean, default: false },
  checked: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  showTime: { type: Boolean, default: false }
})

const emit = defineEmits(['click', 'detail', 'download', 'edit', 'delete', 'check-change'])

const failed = ref(false)

const cover = computed(() => {
  if (failed.value) return ''
  return resolveImageUrl(props.picture?.thumbnailUrl || props.picture?.url)
})

const color = computed(() => normalizeColor(props.picture?.picColor))

// 后端只返回 id，名称从字典翻译；字典缺失时回退成 #id
const categoryLabel = computed(() => {
  const id = props.picture?.categoryId
  return id ? dictStore.categoryName(id) : ''
})

const tagLabels = computed(() => {
  const tags = props.picture?.tags
  if (!Array.isArray(tags)) return []
  return dictStore.tagLabels(tags.filter((t) => t !== null && t !== undefined))
})

// 统一缩略图比例（1:1），保证网格里每张卡片的图片区域等高，不依赖瀑布流
const thumbStyle = computed(() => ({ aspectRatio: '1 / 1' }))

const reviewTag = computed(() => {
  const status = props.picture?.reviewStatus
  if (status === null || status === undefined) return null
  return reviewMeta(status)
})

function onError() {
  failed.value = true
}

function onCheckChange(e) {
  emit('check-change', props.picture.id, e.target.checked)
}
</script>

<style scoped lang="less">
.pic-card {
  position: relative;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
}

.pic-card:hover {
  border-color: #d8dbe6;
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.is-checked {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.thumb {
  position: relative;
  width: 100%;
  background: linear-gradient(135deg, #f4f5f8, #eceef4);
  overflow: hidden;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 26px;
  color: #c3c7d2;
}

.check {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  padding: 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  line-height: 1;
}

.color-chip {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
}

.review-tag {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 2;
  margin: 0;
  font-size: 11px;
  line-height: 18px;
  padding: 0 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: linear-gradient(to top, rgba(15, 18, 26, 0.55), rgba(15, 18, 26, 0.05) 55%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.pic-card:hover .overlay {
  opacity: 1;
}

.overlay-actions {
  display: flex;
  gap: 8px;
}

.act {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 15px;
  color: #1f2430;
  background: rgba(255, 255, 255, 0.94);
  cursor: pointer;
  transition: background 0.16s ease, transform 0.16s ease;
}

.act:hover {
  background: #fff;
  transform: translateY(-2px);
}

.act.danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.meta {
  padding: 10px 12px 12px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 550;
  color: var(--text);
}

.format {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 5px;
  background: #f3f4f8;
  color: var(--text-tertiary);
}

.sub-row,
.time-row {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.time-row {
  color: var(--text-tertiary);
}

.sep {
  margin: 0 5px;
  color: #d3d7e0;
}

.tag-row {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mini-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 5px;
  background: #f3f4f8;
  color: var(--text-secondary);
}
</style>
