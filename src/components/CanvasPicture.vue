<template>
  <div ref="wrapEl" class="canvas-picture-wrap" :class="{ 'is-cover': mode === 'cover' }">
    <canvas
      v-show="state === 'ok'"
      ref="canvasEl"
      class="canvas-picture"
      role="img"
      :aria-label="alt || '图片'"
    />
    <div v-if="state === 'loading'" class="canvas-picture-loading">
      <a-spin :size="spinSize" />
    </div>
    <div v-if="state === 'error'" class="canvas-picture-error">
      <slot name="error">
        <PictureOutlined />
      </slot>
    </div>
  </div>
</template>

<script setup>
/**
 * 用 canvas 渲染图片，页面上不存在 <img src>。
 *
 * 目的：常规的"随手扒图"手段全部失效——
 *   - 右键「图片另存为」「复制图片地址」「在新标签页打开图片」都依赖 <img>，canvas 上一律没有
 *   - 查看网页源代码 / 元素面板里翻不到图片地址
 *   - 图片通过 new Image() 在内存里加载后绘制，不进入 DOM
 *
 * 额外效果：不设置 img.crossOrigin，跨域图片会把 canvas 标记为"已污染"，
 * 控制台里执行 canvas.toDataURL() / getImageData() 会直接抛安全错误，导不出原图。
 *
 * 两种模式：
 *   - contain：详情页大图，按原图比例自适应，不超过容器宽 / maxHeightVh
 *   - cover：列表卡片，填满容器并居中裁剪，等价于 img 的 object-fit: cover
 *
 * 列表用法务必开 lazy：每页十几张图同时解码绘制会拖慢首屏，
 * 用 IntersectionObserver 进入视口才开始加载。
 *
 * 边界：这仍只是提高门槛。抓包、禁用 JS、直接请求接口都能拿到图，
 * 真要防盗必须让图片走带鉴权的后端接口，那是后端改造，这里做不到。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { PictureOutlined } from '@ant-design/icons-vue'

const props = defineProps({
  /** 图片地址（COS 直链或任意可加载地址） */
  src: { type: String, default: '' },
  /** 无障碍描述 */
  alt: { type: String, default: '' },
  /** contain 模式下的最大高度，占视口高度百分比 */
  maxHeightVh: { type: Number, default: 62 },
  /** contain = 详情页自适应；cover = 列表卡片填满裁剪 */
  mode: { type: String, default: 'contain' },
  /** 画布像素比上限：列表用 1 或 1.5 省内存，详情页用 2 保证清晰 */
  maxDpr: { type: Number, default: 2 },
  /** 是否进入视口才加载（列表必须开） */
  lazy: { type: Boolean, default: false },
  /** 加载中图标尺寸 */
  spinSize: { type: String, default: 'default' },
})

const emit = defineEmits(['error'])

const wrapEl = ref(null)
const canvasEl = ref(null)
/** idle(未触发懒加载) | loading | ok | error */
const state = ref('idle')

let imgEl = null
let resizeObserver = null
let intersectionObserver = null

/** contain：按容器宽 + maxHeightVh 等比缩放，不放大超过原图 */
function computeContainSize() {
  const naturalW = imgEl.naturalWidth
  const naturalH = imgEl.naturalHeight
  const maxW = wrapEl.value.clientWidth || naturalW
  const maxH = window.innerHeight * (props.maxHeightVh / 100)
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1)
  return {
    cssW: Math.max(1, Math.floor(naturalW * scale)),
    cssH: Math.max(1, Math.floor(naturalH * scale)),
  }
}

/** cover：填满容器，居中裁剪，等价于 object-fit: cover */
function computeCoverSize() {
  return {
    cssW: Math.max(1, wrapEl.value.clientWidth),
    cssH: Math.max(1, wrapEl.value.clientHeight),
  }
}

function draw() {
  if (state.value !== 'ok' || !canvasEl.value || !imgEl || !wrapEl.value) return
  const naturalW = imgEl.naturalWidth
  const naturalH = imgEl.naturalHeight
  if (!naturalW || !naturalH) return

  const isCover = props.mode === 'cover'
  const { cssW, cssH } = isCover ? computeCoverSize() : computeContainSize()
  const dpr = Math.min(window.devicePixelRatio || 1, props.maxDpr)
  const canvas = canvasEl.value

  if (isCover) {
    canvas.style.width = '100%'
    canvas.style.height = '100%'
  } else {
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
  }
  canvas.width = Math.floor(cssW * dpr)
  canvas.height = Math.floor(cssH * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  if (isCover) {
    // 按 cover 规则算源图裁剪窗口：缩放到刚好覆盖画布，多出来的部分两边各裁一半
    const scale = Math.max(cssW / naturalW, cssH / naturalH)
    const srcW = cssW / scale
    const srcH = cssH / scale
    const srcX = (naturalW - srcW) / 2
    const srcY = (naturalH - srcH) / 2
    ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, cssW, cssH)
  } else {
    ctx.drawImage(imgEl, 0, 0, cssW, cssH)
  }
}

function load() {
  if (!props.src) {
    state.value = 'error'
    emit('error')
    return
  }
  state.value = 'loading'
  imgEl = new Image()
  imgEl.onload = () => {
    state.value = 'ok'
    draw()
  }
  imgEl.onerror = () => {
    state.value = 'error'
    emit('error')
  }
  // 刻意不设置 crossOrigin：跨域图片会让 canvas 被污染，
  // 控制台里 toDataURL() 会抛错，反而多一层防护
  imgEl.src = props.src
}

/** 懒加载：进入视口才开始加载，避免列表一次性解码十几张图 */
function tryLoad() {
  if (state.value !== 'idle') return
  if (props.lazy && typeof IntersectionObserver !== 'undefined' && wrapEl.value) {
    intersectionObserver = new IntersectionObserver((entries) => {
      const hit = entries.some((e) => e.isIntersecting)
      if (!hit) return
      intersectionObserver.disconnect()
      intersectionObserver = null
      load()
    })
    intersectionObserver.observe(wrapEl.value)
  } else {
    load()
  }
}

function handleResize() {
  draw()
}

function reset() {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
  if (imgEl) {
    imgEl.onload = null
    imgEl.onerror = null
    imgEl = null
  }
  state.value = 'idle'
}

onMounted(() => {
  tryLoad()
  window.addEventListener('resize', handleResize)
  // 容器尺寸变化（栅格列数变化 / 侧边栏折叠）也要重绘
  if (typeof ResizeObserver !== 'undefined' && wrapEl.value) {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(wrapEl.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
  if (imgEl) {
    imgEl.onload = null
    imgEl.onerror = null
    imgEl = null
  }
})

watch(
  () => props.src,
  () => {
    reset()
    tryLoad()
  },
)
</script>

<style scoped>
.canvas-picture-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 120px;
}

/* 列表卡片：撑满父级缩略图容器，由父容器提供比例（如 16:10） */
.canvas-picture-wrap.is-cover {
  position: absolute;
  inset: 0;
  min-height: 0;
}

.canvas-picture {
  display: block;
  border-radius: 8px;
  /* 不能被选中、不能被拖走 */
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
}

.is-cover .canvas-picture {
  border-radius: 0;
  box-shadow: none;
}

.canvas-picture-loading {
  padding: 40px 0;
}

.canvas-picture-error {
  display: grid;
  place-items: center;
  font-size: 26px;
  color: #9aa1ae;
}
</style>
