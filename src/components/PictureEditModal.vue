<template>
  <a-modal
    :open="open"
    :title="isEdit ? '编辑图片信息' : '完善图片信息'"
    :confirm-loading="submitting"
    ok-text="保存"
    cancel-text="取消"
    width="620px"
    :ok-button-props="{ disabled: replacing }"
    @cancel="close"
    @ok="handleOk"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-tag v-if="replaced" color="blue" class="replaced-tag">已选择新图片，保存后将替换原图</a-tag>

      <div v-if="previewUrl" class="preview-row">
        <img :src="previewUrl" alt="预览" class="preview-img" />
        <div class="preview-meta">
          <div class="preview-name ellipsis-1">{{ form.picName || '未命名图片' }}</div>
          <div class="preview-sub">
            {{ form.picWidth || '-' }} × {{ form.picHeight || '-' }} ·
            {{ formatSize(form.picSize) }} · {{ String(form.picFormat || '-').toUpperCase() }}
          </div>
          <div class="preview-sub">
            <span class="dot" :style="{ background: color || '#c9cdd8' }" />
            {{ color || '未识别主色调' }}
            <span class="server-tag">自动解析</span>
          </div>
        </div>
        <div class="preview-actions">
          <a-button size="small" :loading="replacing" @click="replacingOpen = !replacingOpen">
            <template #icon>
              <SwapOutlined />
            </template>
            {{ replaced ? '重新更换' : '更换图片' }}
          </a-button>
        </div>
      </div>

      <div v-if="replacingOpen" class="replace-panel">
        <a-upload-dragger
          :show-upload-list="false"
          accept="image/*"
          :before-upload="handleReplaceFile"
          :disabled="replacing"
        >
          <p class="ant-upload-text">
            <InboxOutlined />
            点击或拖拽新图片到此处
          </p>
          <p class="ant-upload-hint">仅替换图片来源，名称、分类、标签保持不变</p>
        </a-upload-dragger>
        <div class="replace-url">
          <a-input
            v-model:value="fileUrl"
            placeholder="或粘贴图片直链，例如 https://example.com/a.jpg"
            allow-clear
            @press-enter="handleReplaceUrl"
          />
          <a-button :loading="replacing" :disabled="!fileUrl" @click="handleReplaceUrl">抓取并替换</a-button>
        </div>
        <p class="replace-hint">
          新图片会先暂存，点击底部「保存」后才正式替换原图；
          尺寸、体积、主色调将在替换时自动重新解析。
        </p>
      </div>

      <a-form-item name="picName" label="图片名称">
        <a-input v-model:value="form.picName" placeholder="给图片起个名字" :maxlength="64" show-count allow-clear />
      </a-form-item>

      <a-form-item name="introduction" label="简介">
        <a-textarea
          v-model:value="form.introduction"
          placeholder="补充图片描述，便于后续检索"
          :rows="3"
          :maxlength="200"
          show-count
        />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item name="categoryId" label="分类">
            <a-select
              v-model:value="form.categoryId"
              :options="categoryOptions"
              placeholder="可选"
              allow-clear
              show-search
              option-filter-prop="label"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item name="tagIds" label="标签">
            <a-select
              v-model:value="form.tagIds"
              mode="multiple"
              :options="tagOptions"
              placeholder="可多选"
              allow-clear
              style="width: 100%"
              :max-tag-count="2"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <div class="readonly-note">
        主色调、尺寸、体积与格式在上传时自动解析，不提供修改。
      </div>
    </a-form>
  </a-modal>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { InboxOutlined, SwapOutlined } from '@ant-design/icons-vue'
import { useDictStore } from '@/stores/dict'
import { useUserStore } from '@/stores/user'
import { formatSize, normalizeColor } from '@/utils/format'
import { resolveImageUrl } from '@/utils/image'
import { uploadPicture, uploadPictureByUrl } from '@/api/picture'

const dictStore = useDictStore()
const userStore = useUserStore()

const props = defineProps({
  open: { type: Boolean, default: false },
  /** 传入已有图片则为编辑态 */
  picture: { type: Object, default: null },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open', 'submit'])

const formRef = ref()

const emptyForm = () => ({
  id: undefined,
  url: '',
  thumbnailUrl: '',
  picName: '',
  introduction: '',
  categoryId: undefined,
  tagIds: [],
  picSize: undefined,
  picWidth: undefined,
  picHeight: undefined,
  picScale: undefined,
  picFormat: '',
  /** 服务端解析结果，仅用于展示，不参与提交 */
  picColor: ''
})

const form = reactive(emptyForm())

const categoryOptions = computed(() => dictStore.categoryOptions)
const tagOptions = computed(() => dictStore.tagOptions)

const isEdit = computed(() => Boolean(props.picture?.id))
// 表单里的 url 保持后端原始相对路径，仅预览时拼接域名
const previewUrl = computed(() => resolveImageUrl(form.thumbnailUrl || form.url))
const color = computed(() => normalizeColor(form.picColor))

// 更换图片相关状态：replacingOpen 控制面板显隐，replacing 控制上传中，replaced 标记已选新图
const replacingOpen = ref(false)
const replacing = ref(false)
const replaced = ref(false)
const fileUrl = ref('')

/** 把上传结果回填到表单：地址与解析字段全部更新，触发后端换图迁移；名称等用户字段保持不动 */
function applyUploaded(vo) {
  if (!vo) return
  form.url = vo.url
  form.thumbnailUrl = vo.thumbnailUrl
  form.picSize = vo.picSize
  form.picWidth = vo.picWidth
  form.picHeight = vo.picHeight
  form.picScale = vo.picScale
  form.picFormat = vo.picFormat
  form.picColor = vo.picColor
  replaced.value = true
  replacingOpen.value = false
}

/** 本地文件更换：走 /picture/upload，返回的是 temp 目录临时地址，符合后端换图约束 */
async function handleReplaceFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  replacing.value = true
  try {
    const vo = await uploadPicture(formData)
    applyUploaded(vo)
    message.success('已选择新图片，点击保存后生效')
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    replacing.value = false
  }
  // 阻止 a-upload 自带的上传行为
  return false
}

/** 图片链接更换：走 /picture/uploadByUrl，同样返回 temp 目录临时地址 */
async function handleReplaceUrl() {
  if (!fileUrl.value) return
  replacing.value = true
  try {
    const vo = await uploadPictureByUrl(fileUrl.value)
    applyUploaded(vo)
    message.success('已选择新图片，点击保存后生效')
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    replacing.value = false
  }
}

const rules = {
  picName: [{ max: 64, message: '名称不能超过 64 个字符', trigger: 'blur' }],
  introduction: [{ max: 200, message: '简介不能超过 200 个字符', trigger: 'blur' }]
}

watch(
  () => [props.open, props.picture],
  ([open, picture]) => {
    if (!open) return
    const base = emptyForm()
    if (picture) {
      Object.assign(base, {
        id: picture.id,
        url: picture.url || '',
        thumbnailUrl: picture.thumbnailUrl || '',
        picName: picture.picName || '',
        introduction: picture.introduction || '',
        categoryId: picture.categoryId ?? undefined,
        // 下拉选项是字符串 id（后端 Long 已序列化为 String），这里统一转字符串才能正确回显
        tagIds: Array.isArray(picture.tags)
          ? picture.tags.map((v) => String(v)).filter(Boolean)
          : [],
        picSize: picture.picSize,
        picWidth: picture.picWidth,
        picHeight: picture.picHeight,
        picScale: picture.picScale,
        picFormat: picture.picFormat || '',
        picColor: picture.picColor || ''
      })
    }
    Object.assign(form, base)
    formRef.value?.clearValidate()
    // 每次打开重置换图状态
    replaced.value = false
    replacingOpen.value = false
    fileUrl.value = ''
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  dictStore.load()
})

function close() {
  emit('update:open', false)
}

async function handleOk() {
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }
  emit('submit', {
    id: form.id,
    url: form.url,
    thumbnailUrl: form.thumbnailUrl,
    picName: form.picName,
    introduction: form.introduction,
    categoryId: form.categoryId ?? undefined,
    tagIds: (form.tagIds || []).map((v) => String(v)).filter(Boolean),
    picSize: form.picSize,
    picWidth: form.picWidth,
    picHeight: form.picHeight,
    picScale: form.picScale,
    picFormat: form.picFormat,
    picColor: form.picColor
  })
}
</script>

<style scoped lang="less">
.preview-row {
  display: flex;
  gap: 14px;
  padding: 12px;
  margin-bottom: 18px;
  border-radius: var(--radius);
  background: #f7f8fc;
  border: 1px solid var(--border);
}

.preview-img {
  width: 88px;
  height: 88px;
  border-radius: 10px;
  object-fit: cover;
  background: #eceef4;
  flex-shrink: 0;
}

.preview-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.preview-actions {
  margin-left: auto;
  align-self: flex-start;
}

.replaced-tag {
  margin-bottom: 12px;
}

.replace-panel {
  padding: 14px;
  margin-bottom: 18px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--bg);
}

.replace-url {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.replace-url .ant-input {
  flex: 1;
}

.replace-hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.preview-name {
  font-weight: 600;
  font-size: 15px;
}

.preview-sub {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.server-tag {
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  color: var(--text-tertiary);
  background: var(--bg);
  border: 1px solid var(--border);
}

.readonly-note {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--bg);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}
</style>
