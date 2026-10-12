<template>
  <a-modal
    :open="open"
    title="编辑图片"
    width="92vw"
    centered
    :mask-closable="false"
    wrap-class-name="editor-modal-wrap"
    ok-text="保存修改"
    cancel-text="取消"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !ready || saving }"
    @cancel="handleCancel"
    @ok="handleSave"
  >
    <div class="editor-shell">
      <!-- 顶部：工具区 -->
      <div class="toolbar">
        <a-space size="small" wrap>
          <a-tooltip title="向左旋转 90 度">
            <a-button size="small" :disabled="!ready" @click="rotate(-90)">
              <template #icon><UndoOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="向右旋转 90 度">
            <a-button size="small" :disabled="!ready" @click="rotate(90)">
              <template #icon><RedoOutlined /></template>
            </a-button>
          </a-tooltip>

          <a-divider type="vertical" />

          <a-tooltip title="缩小图片（改变图片本身的尺寸）">
            <a-button size="small" :disabled="!ready" @click="scalePicture(1 / SCALE_STEP)">
              <template #icon><ZoomOutOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip :title="`图片尺寸 ${Math.round(canvasSize.width)} × ${Math.round(canvasSize.height)}`">
            <span class="zoom-text">{{ zoomPercent }}%</span>
          </a-tooltip>
          <a-tooltip title="放大图片（改变图片本身的尺寸）">
            <a-button size="small" :disabled="!ready" @click="scalePicture(SCALE_STEP)">
              <template #icon><ZoomInOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="回到原图尺寸（100%）">
            <a-button size="small" :disabled="!ready" @click="resetPictureScale">
              <template #icon><CompressOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="适应窗口（只改变视图，不改图片尺寸）">
            <a-button
              size="small"
              :disabled="!ready"
              :type="viewFit ? 'primary' : 'default'"
              @click="fitWindow"
            >
              <template #icon><FullscreenOutlined /></template>
            </a-button>
          </a-tooltip>

          <a-divider type="vertical" />

          <a-button size="small" :disabled="!ready" @click="toggleCrop">
            <template #icon><ScissorOutlined /></template>
            {{ cropping ? '取消裁剪' : '裁剪' }}
          </a-button>
          <a-button
            v-if="cropping"
            size="small"
            type="primary"
            :disabled="!cropRect"
            @click="applyCrop"
          >
            应用裁剪
          </a-button>
          <a-button size="small" :disabled="!ready" @click="toggleMosaic">
            <template #icon><BlockOutlined /></template>
            {{ mosaicMode ? '退出打码' : '打码' }}
          </a-button>

          <a-divider type="vertical" />

          <a-tooltip title="撤销">
            <a-button size="small" :disabled="!history.length" @click="undo">
              <template #icon><RollbackOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="重做">
            <a-button size="small" :disabled="!redoStack.length" @click="redo">
              <template #icon><ForwardOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="删除所选马赛克">
            <a-button size="small" danger :disabled="!hasSelection" @click="removeSelected">
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </a-tooltip>
        </a-space>
      </div>

      <!-- 主体：画布 + 侧栏 -->
      <div class="editor-body">
        <div class="canvas-area" ref="canvasWrap">
          <div class="canvas-stage">
            <div class="canvas-holder" ref="canvasHolder" @scroll.passive="refreshCursorPositions">
              <canvas ref="canvasEl" />
              <div v-if="!ready && !loadError" class="canvas-mask">
                <a-spin tip="正在加载原图…" />
              </div>
              <div v-if="loadError" class="canvas-mask">
                <a-result status="warning" :title="loadError" sub-title="请确认图片可正常访问后重试" />
              </div>
            </div>
            <!--
              远端协作者光标放在滚动容器之外的覆盖层里：
              名牌靠近边缘时若参与布局，会把滚动区撑出滚动条，画面跟着抖一下
            -->
            <div v-if="collaborative" class="cursor-layer">
              <div
                v-for="cursor in remoteCursors"
                :key="cursor.userId"
                class="remote-cursor"
                :style="{ left: cursor.screenX + 'px', top: cursor.screenY + 'px' }"
              >
                <span class="cursor-dot" :style="{ background: cursor.color }" />
                <span class="cursor-name" :style="{ background: cursor.color }">{{ cursor.userName }}</span>
              </div>
            </div>
          </div>
          <div class="canvas-footer">
            <a-space size="middle" wrap>
              <span class="meta">{{ picture?.picWidth || '-' }} × {{ picture?.picHeight || '-' }} 原图</span>
              <span class="meta">画布 {{ Math.round(canvasSize.width) }} × {{ Math.round(canvasSize.height) }}</span>
              <span v-if="overflowing" class="meta">画面已超出窗口，可滚动查看</span>
              <span v-if="collaborative" class="meta">已同步 {{ opCount }} 次编辑</span>
              <template v-if="collaborative">
                <a-tag v-if="collabOpen" color="green">协作中</a-tag>
                <a-tag v-else color="default">离线编辑</a-tag>
              </template>
            </a-space>
          </div>
        </div>

        <!-- 侧栏 -->
        <div class="side-panel">
          <div class="side-scroll">
            <div class="panel-block">
            <div class="panel-title">画面调整</div>
            <div class="prop-row">
              <span class="prop-label">色调</span>
              <a-radio-group v-model:value="filterState.tone" size="small" button-style="solid" @change="commitFilter">
                <a-radio-button value="origin">原图</a-radio-button>
                <a-radio-button value="gray">灰度</a-radio-button>
                <a-radio-button value="bw">黑白</a-radio-button>
              </a-radio-group>
            </div>
            <div class="prop-row">
              <span class="prop-label">亮度</span>
              <a-slider
                :value="filterState.brightness"
                :min="-100"
                :max="100"
                :disabled="!ready"
                style="flex: 1"
                @change="(value) => onFilterInput('brightness', value)"
                @after-change="commitFilter"
              />
            </div>
            <div class="prop-row">
              <span class="prop-label">对比度</span>
              <a-slider
                :value="filterState.contrast"
                :min="-100"
                :max="100"
                :disabled="!ready"
                style="flex: 1"
                @change="(value) => onFilterInput('contrast', value)"
                @after-change="commitFilter"
              />
            </div>
            <div class="prop-row">
              <span class="prop-label">饱和度</span>
              <a-slider
                :value="filterState.saturation"
                :min="-100"
                :max="100"
                :disabled="!ready"
                style="flex: 1"
                @change="(value) => onFilterInput('saturation', value)"
                @after-change="commitFilter"
              />
            </div>
            <div class="prop-row">
              <span class="prop-label">模糊</span>
              <a-slider
                :value="filterState.blur"
                :min="0"
                :max="100"
                :disabled="!ready"
                style="flex: 1"
                @change="(value) => onFilterInput('blur', value)"
                @after-change="commitFilter"
              />
            </div>
            <a-button size="small" block :disabled="!ready" @click="resetFilter">恢复默认</a-button>
          </div>

          <div class="panel-block">
            <div class="panel-title">图片打码</div>
            <div class="prop-row">
              <span class="prop-label">色块</span>
              <a-slider
                :value="mosaicBlock"
                :min="4"
                :max="64"
                :disabled="!ready"
                style="flex: 1"
                @change="onMosaicBlockInput"
                @after-change="commitMosaicBlock"
              />
            </div>
            <div class="panel-hint">
              点工具栏「打码」，在要遮挡的地方拖一个框，松开即完成。选中已打好的色块后调上面的「色块」值，可以实时改这一块的颗粒；色块不能拖动，打错了就选中删掉重打。
            </div>
          </div>

          <div v-if="collaborative" class="panel-block">
            <div class="panel-title">协作者</div>
            <div v-if="members.length" class="member-list">
              <div v-for="member in members" :key="member.userId" class="member-item">
                <span class="member-avatar" :style="{ background: member.color }">
                  {{ (member.userName || '?').slice(0, 1).toUpperCase() }}
                </span>
                <span class="member-name ellipsis-1">{{ member.userName }}</span>
                <a-tag v-if="member.self" color="blue" class="self-tag">我</a-tag>
              </div>
            </div>
            <div v-else class="panel-empty">暂无其他成员</div>
            <div class="panel-hint">修改实时同步；点「保存修改」才会替换原图。</div>
          </div>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  BlockOutlined,
  CompressOutlined,
  DeleteOutlined,
  ForwardOutlined,
  FullscreenOutlined,
  RedoOutlined,
  RollbackOutlined,
  ScissorOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons-vue'
import * as fabric from 'fabric'
import {
  BASE_IMAGE_ID,
  CANVAS_ID,
  DEFAULT_FILTER_STATE,
  applyFilterState,
  applyOperation,
  baseSnapshot,
  canvasBounds,
  clampAreaToBounds,
  computeDisplayScale,
  createCropRect,
  createMosaicPatch,
  cropCanvas,
  ensureElementId,
  exportCanvasBlob,
  findObject,
  fitCanvasToBase,
  fitScaleFor,
  isMosaicPatch,
  loadBaseImage,
  newElementId,
  newOpId,
  normalizeFilterState,
  serializeObject,
  updateCropRect,
  updatePayloadOf
} from '@/utils/canvasEditor'
import { createCollabSocket } from '@/utils/collabSocket'
import { uploadPicture, updatePicture } from '@/api/picture'
import { getToken } from '@/api/request'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const props = defineProps({
  open: { type: Boolean, default: false },
  picture: { type: Object, default: null },
  /**
   * 是否启用协作（只有团队空间的图片才需要）
   *
   * 关掉后：不建立协作连接、不上报光标、不显示协作者列表 / 远端光标 / 协作状态标签。
   * 画布、滤镜、裁剪、打码、保存等单机能力完全不受影响。
   */
  collaborative: { type: Boolean, default: false }
})

const emit = defineEmits(['update:open', 'saved'])

const canvasEl = ref()
const canvasWrap = ref()
const canvasHolder = ref()
const ready = ref(false)
const loadError = ref('')
const saving = ref(false)

const cropping = ref(false)
const cropRect = ref(null)
const mosaicMode = ref(false)
const mosaicBlock = ref(12)
const hasSelection = ref(false)
const opCount = ref(0)
const canvasSize = reactive({ width: 0, height: 0 })
/** 画布的实际显示缩放比（1 = 画布像素 1:1 呈现） */
const viewScale = ref(1)
/**
 * 图片相对「基准尺寸」的倍率：1 = 100%
 * <p>基准尺寸 = 打开时的图片尺寸；裁剪后改成裁剪所得尺寸（旋转 90° 时长宽互换）。
 */
const pictureScale = ref(1)
/**
 * 视图模式：false = 跟随图片真实尺寸（放大就真的变大，超出窗口可滚动查看）；
 * true = 适应窗口（只把当前画面缩到完整可见，不改图片尺寸）。
 */
const viewFit = ref(false)
const originSize = reactive({ width: 0, height: 0 })

/** 整图滤镜参数：底图滤镜的唯一数据源，界面、撤销、协作都以它为准 */
const filterState = ref({ ...DEFAULT_FILTER_STATE })

const members = ref([])
const remoteCursors = ref([])
const collabOpen = ref(false)
const selfId = ref('')

const history = ref([])
const redoStack = ref([])

/**
 * 非响应式的实例句柄
 *
 * 必须在任何 immediate watch 之前声明：watch 的 immediate 回调在 setup 期间同步执行，
 * 若此处后置会导致暂时性死区（TDZ）报错 Cannot access 'canvas' before initialization。
 */
let canvas = null

// 画布背景底色随主题变化（这是编辑区底色，不是图片内容本身）
function canvasBg() {
  return getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff'
}
let applyingRemote = false
/** 当前正在拖的选框：'crop' 裁剪、'mosaic' 打码 */
let dragMode = null
let dragStart = null
let dragRect = null
let cropSelection = null
/** 拖框时挂在 document 上的 mouseup 兜底（鼠标移出画布再松手也能收尾） */
let outsideMouseUp = null
let objectUrl = ''
let lastPointerAt = 0
let socket = null
let beforeModify = new Map()
/** 滤镜实时预览的防抖定时器 */
let filterTimer = null
/** 本次滑杆拖动开始前的已提交状态（撤销基线） */
let filterDragBase = null
/** 拖动途中广播的节流时间戳 */
let lastFilterBroadcastAt = 0
/** 本地发出的 opId：服务端会把操作回发给自己，用于判断"自己的回声" */
const selfOpIds = new Set()
/**
 * 最近一次「已提交」的滤镜状态（广播出去或从协作端确认过的）
 *
 * 不能拿 base.filterState 当基线：拖动滑杆时的本地预览会把它改写成未提交的值，
 * 松手时再对比就会"看起来没变化"而跳过广播，协作者那边就收不到亮度/对比度等调整。
 */
let committedFilter = { ...DEFAULT_FILTER_STATE }

/** 以底图上的真实滤镜状态为准，回填滑杆显示与「已提交」基线（远端/撤销/快照路径都走这里） */
/**
 * 用底图上的真实滤镜状态刷新界面（远端 / 撤销路径）
 *
 * 自己的回声不走这里：拖动途中服务端会把操作回发给自己，此时覆盖界面会把用户
 * 刚拖到的位置改回上一次广播值，滑杆看起来会"自己往回跳"。
 */
function syncFilterFromBase() {
  const base = canvas ? findObject(canvas, BASE_IMAGE_ID) : null
  const next = base?.filterState ? { ...base.filterState } : { ...DEFAULT_FILTER_STATE }
  // 挂起的本地预览作废：否则 60ms 后会把别人刚改的状态又盖回本地预览值
  if (filterTimer) {
    clearTimeout(filterTimer)
    filterTimer = null
  }
  filterState.value = { ...next }
  committedFilter = { ...next }
  filterDragBase = null
}
/** 调整选中色块颗粒的防抖定时器 */
let retuneTimer = null
/** 这次颗粒调整开始前的色块快照（撤销用） */
let retuneBase = null
/** 视口自适应：监听画布容器尺寸，窗口变化时重新贴合 */
let resizeObserver = null

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

/** 画布四周留出的呼吸空间，避免贴着容器边缘 */
const CANVAS_PADDING = 16

/**
 * 图片尺寸（缩放）的取值范围
 *
 * - 上限 200%：相对原图放大一倍就够用了，再高只是插值出来的模糊像素；
 * - 下限长边 32px：再小就看不出画面内容；
 * - 这里的缩放改的是**图片真实像素**（保存后图片就是这个尺寸），不是显示倍率。
 */
const MAX_PICTURE_SCALE = 2
const MIN_PICTURE_SIDE = 32
const SCALE_STEP = 1.25
/** 滑杆拖动途中同步给协作者的节流间隔（毫秒） */
const FILTER_BROADCAST_INTERVAL = 150

const zoomPercent = computed(() => Math.round(pictureScale.value * 100))

/** 画面是否大到超出可视区（此时容器会出现滚动条） */
const overflowing = ref(false)

/**
 * 让画布按可视区呈现
 *
 * 只改 CSS 呈现尺寸，不动画布的像素尺寸：导出时仍然是画布的真实分辨率。
 *
 * 关键是**显示比例不随当前尺寸重算**：
 * 比例固定为"基准尺寸（原图）放进可视区"的比例，于是图片放大 → 画布逻辑尺寸变大 →
 * 屏幕上的画面跟着变大（超出可视区的部分滚动查看），放大才有肉眼可见的反馈。
 * 若每次都按当前尺寸缩回窗口，放大的结果会被显示比例抵消，看上去就像没放大一样。
 *
 * fabric 的指针换算内部已经按 "像素尺寸 / 实际渲染宽度" 做了校正，
 * 所以这里**不要**再叠加 setZoom —— 两者同时用会导致双重缩放，表现为点不中、拖不动。
 */
function fitToViewport() {
  if (!canvas || !canvasHolder.value) return
  const logicWidth = canvas.getWidth()
  const logicHeight = canvas.getHeight()
  if (!logicWidth || !logicHeight) return
  // 弹窗刚打开、过渡还没跑完时容器尺寸可能是 0，交给 ResizeObserver 在布局稳定后再贴合
  if (canvasHolder.value.clientWidth < 40 || canvasHolder.value.clientHeight < 40) return
  const availWidth = Math.max(80, canvasHolder.value.clientWidth - CANVAS_PADDING * 2)
  const availHeight = Math.max(80, canvasHolder.value.clientHeight - CANVAS_PADDING * 2)
  const scale = computeDisplayScale({
    logicWidth,
    logicHeight,
    originWidth: originSize.width,
    originHeight: originSize.height,
    availWidth,
    availHeight,
    mode: viewFit.value ? 'fit' : 'real',
    minDisplaySide: MIN_PICTURE_SIDE
  })
  if (!Number.isFinite(scale) || scale <= 0) return
  viewScale.value = scale
  overflowing.value = logicWidth * scale > availWidth + 1 || logicHeight * scale > availHeight + 1
  canvas.setDimensions({ width: logicWidth * scale, height: logicHeight * scale }, { cssOnly: true })
  canvas.requestRenderAll()
  // 显示比例变了，远端光标的屏幕位置要跟着重算
  refreshCursorPositions()
}

/** 视图缩回完整可见（只改视图，图片尺寸不变） */
function fitWindow() {
  viewFit.value = true
  fitToViewport()
  // 画面超出容器时把滚动位置归零，避免停在边角上看着像"图没了"
  if (canvasHolder.value) {
    canvasHolder.value.scrollLeft = 0
    canvasHolder.value.scrollTop = 0
  }
}

/** 视图不再固定于"适应窗口"，重新跟随图片真实尺寸 */
function unfollowFit() {
  if (!viewFit.value) return
  viewFit.value = false
}

/**
 * 改变图片的真实尺寸
 *
 * 底图与所有元素（马赛克色块）一起等比缩放，画布尺寸跟着变，
 * 因此导出 / 保存下来的图片就是放大或缩小之后的尺寸。
 */
function scalePicture(factor) {
  if (!canvas || !ready.value || !originSize.width || !originSize.height) return
  const minRatio = Math.min(1, MIN_PICTURE_SIDE / Math.max(originSize.width, originSize.height))
  const next = Math.round(Math.min(MAX_PICTURE_SCALE, Math.max(minRatio, pictureScale.value * factor)) * 1000) / 1000
  if (Math.abs(next - pictureScale.value) < 0.001) return
  // 改真实尺寸时视图必须跟着走，否则"适应窗口"会把放大的效果又缩回去
  unfollowFit()
  applyPictureScale(next)
}

/** 回到原图尺寸（100%） */
function resetPictureScale() {
  if (Math.abs(pictureScale.value - 1) < 0.001) return
  unfollowFit()
  applyPictureScale(1)
}

/** 应用一条操作（本地或远端），并在画布尺寸可能变化后重新贴合视口 */
async function applyOp(op) {
  if (!canvas) return
  await applyOperation(canvas, op)
  // 裁剪、整图旋转这类操作会改画布尺寸，侧栏显示要跟着更新
  canvasSize.width = canvas.getWidth()
  canvasSize.height = canvas.getHeight()
  syncPictureScale(op)
  // 滤镜可能被别人（或撤销）改过，界面滑块要跟着回到真实状态；
  // 但自己刚发出去的回声不刷新界面，否则拖动中的滑杆会被拽回上一次广播值
  if (!(op?.opId && selfOpIds.has(op.opId))) {
    syncFilterFromBase()
  }
  // 撤销 / 重做 / 远端操作都会挪动元素，改动前的快照必须按"应用后的真实状态"重建，
  // 否则下次拖动同一块时算出来的反向数据会是陈旧位置，撤销会一次跳回好几步之前
  refreshBeforeStates()
  fitToViewport()
}

/**
 * 同步「图片尺寸倍率」
 *
 * 走这条路径的有三种情况：自己的缩放被服务端广播回来、别人缩放、别人裁剪。
 * 裁剪（payload.crop）会换掉基准尺寸，倍率归 1；纯尺寸变化则按基准尺寸反推倍率。
 */
function syncPictureScale(op) {
  if (!op || op.action !== 'canvas' || !op.payload?.width) return
  // 裁剪换掉了基准尺寸（旋转只是长宽互换，倍率要保留）
  if (op.payload.crop) {
    originSize.width = op.payload.width
    originSize.height = op.payload.height
    pictureScale.value = 1
    return
  }
  if (!originSize.width) return
  pictureScale.value = Math.round((op.payload.width / originSize.width) * 1000) / 1000
}

/** 按画布当前状态重建所有元素的"改动前快照" */
function refreshBeforeStates() {
  if (!canvas) return
  beforeModify.clear()
  canvas.forEachObject((object) => {
    if (object.customId === BASE_IMAGE_ID || object.internal) {
      return
    }
    beforeModify.set(ensureElementId(object), updatePayloadOf(object))
  })
}

function watchViewportResize() {
  if (!canvasHolder.value || typeof ResizeObserver === 'undefined') return
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => fitToViewport())
  resizeObserver.observe(canvasHolder.value)
}

/**
 * 打开时初始化：加载原图 → 建立画布 → 连接协作通道
 */
watch(
  () => props.open,
  async (open) => {
    // 编辑期间锁定背景页面滚动（html 上的滚动盒不受 body overflow 控制，两级都要锁）
    document.documentElement.style.overflow = open ? 'hidden' : ''
    document.body.style.overflow = open ? 'hidden' : ''
    if (!open) {
      teardown()
      return
    }
    await nextTick()
    await initCanvas()
  }
)

// 主题切换时同步画布底色（不影响图片内容与已编辑操作）
watch(
  () => themeStore.mode,
  () => {
    if (canvas) {
      canvas.setBackgroundColor(canvasBg(), canvas.renderAll.bind(canvas))
    }
  }
)

/**
 * 等待弹窗内的 canvas 节点真正挂载
 *
 * a-modal 的内容是首次打开时才渲染（且带过渡），仅 await nextTick() 未必拿得到 DOM，
 * 直接 new fabric.Canvas(undefined) 会抛错导致编辑器白屏。这里轮询一小段时间兜底。
 */
async function waitForCanvasEl(timeout = 3000) {
  const deadline = Date.now() + timeout
  while (!canvasEl.value && Date.now() < deadline) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  return Boolean(canvasEl.value)
}

async function initCanvas() {
  loadError.value = ''
  ready.value = false
  pictureScale.value = 1
  viewFit.value = false
  overflowing.value = false
  filterState.value = { ...DEFAULT_FILTER_STATE }
  committedFilter = { ...DEFAULT_FILTER_STATE }
  filterDragBase = null
  lastFilterBroadcastAt = 0
  mosaicMode.value = false
  cropping.value = false
  cropRect.value = null
  if (canvas) {
    canvas.dispose()
    canvas = null
  }
  const picture = props.picture
  if (!picture?.id) {
    loadError.value = '缺少图片信息'
    return
  }
  if (!(await waitForCanvasEl())) {
    loadError.value = '画布初始化失败'
    return
  }
  const url = await fetchImageObjectUrl(picture.id)
  if (!url) {
    return
  }
  // 加载期间用户可能已关闭弹窗，此时不应再往 DOM 上挂画布
  if (!props.open || !canvasEl.value) {
    URL.revokeObjectURL(url)
    return
  }
  objectUrl = url

  canvas = new fabric.Canvas(canvasEl.value, {
    preserveObjectStacking: true,
    selection: true,
    backgroundColor: canvasBg()
  })

  const image = await loadBaseImage(canvas, url)
  if (!canvas) {
    // 图片加载过程中弹窗被关闭，画布已销毁
    return
  }
  const baseWidth = image.width || picture.picWidth || 800
  const baseHeight = image.height || picture.picHeight || 600
  canvas.setDimensions({ width: baseWidth, height: baseHeight })
  canvasSize.width = baseWidth
  canvasSize.height = baseHeight
  // 缩放的基准尺寸：打开时的图片尺寸即 100%
  originSize.width = baseWidth
  originSize.height = baseHeight
  pictureScale.value = 1
  canvas.add(image)
  canvas.requestRenderAll()

  bindCanvasEvents()
  // 先按容器尺寸贴合一次，再开始监听窗口变化
  fitToViewport()
  watchViewportResize()
  ready.value = true
  connect()
}

/**
 * 通过后端下载接口取同源 Blob
 *
 * 不直接用对象存储的外链：跨域图片会把画布"污染"，导出时浏览器会拒绝返回像素数据。
 */
async function fetchImageObjectUrl(pictureId) {
  try {
    const response = await fetch(`${API_BASE}/picture/download?id=${encodeURIComponent(pictureId)}`, {
      headers: { Authorization: getToken() || '' }
    })
    if (!response.ok) {
      throw new Error('下载失败')
    }
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (e) {
    loadError.value = '原图加载失败'
    return ''
  }
}

function bindCanvasEvents() {
  canvas.on('selection:created', syncSelection)
  canvas.on('selection:updated', syncSelection)
  canvas.on('selection:cleared', () => {
    hasSelection.value = false
  })

  canvas.on('mouse:down', handleCanvasMouseDown)
  canvas.on('mouse:up', handleCanvasMouseUp)
  canvas.on('mouse:move', (opt) => {
    trackPointer(opt)
    updateDrag(opt)
  })

  canvas.on('object:added', ({ target }) => {
    if (applyingRemote || !target) {
      return
    }
    // 底图是本地加载的背景、选框只是本地提示，两者都不参与元素级同步
    if (target.customId === BASE_IMAGE_ID || target.internal) {
      return
    }
    const targetId = ensureElementId(target)
    const forward = { opId: newOpId(), action: 'add', targetId, payload: serializeObject(target) }
    // 删除后的"还原"需要完整快照，因此新增的逆操作就是删除
    pushHistory(forward, { action: 'remove', targetId })
    emitOperation(forward)
  })

  canvas.on('object:modified', ({ target }) => {
    if (applyingRemote || !target) {
      return
    }
    handleModified(target)
  })

}

function syncSelection() {
  hasSelection.value = Boolean(canvas.getActiveObject())
}

/** 两次元素状态是否一致（避免锁死的元素被点一下就记一步撤销） */
function sameUpdatePayload(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const key of keys) {
    const left = a?.[key]
    const right = b?.[key]
    if (typeof left === 'number' || typeof right === 'number') {
      if (Math.round((left ?? 0) * 1000) !== Math.round((right ?? 0) * 1000)) return false
    } else if (left !== right) {
      return false
    }
  }
  return true
}

function handleModified(target) {
  const objects = target.type === 'activeselection' ? target.getObjects() : [target]
  objects.forEach((object) => {
    const targetId = ensureElementId(object)
    const previous = beforeModify.get(targetId) || {}
    const payload = updatePayloadOf(object)
    // 色块锁死了移动 / 缩放，点一下也会走到这里；没真的变就别记一步空历史
    if (sameUpdatePayload(previous, payload)) return
    const forward = { opId: newOpId(), action: 'update', targetId, payload }
    pushHistory(forward, { action: 'update', targetId, payload: previous })
    emitOperation(forward)
    beforeModify.set(targetId, payload)
  })
}

/* ---------------- 整图操作 ---------------- */

/**
 * 切换普通元素的可交互性（裁剪 / 打码模式下暂时禁用）
 * <p>底图永远不参与：它是被锁死的背景，任何情况下都不能被鼠标拖动或选中。
 */
function setObjectsInteractive(enabled) {
  canvas.forEachObject((object) => {
    if (object.customId === BASE_IMAGE_ID || object.internal) {
      return
    }
    object.selectable = enabled
    object.evented = enabled
  })
}

/**
 * 改动底图（旋转）并让画布跟着变
 *
 * 画布尺寸必须等于底图的实际大小：否则旋转后竖图会被横向画布切掉，画面直接丢失。
 * 撤销快照一定要在改底图**之前**取，否则撤销等于没做。
 *
 * @param {(base: fabric.FabricImage) => void} mutate 对底图的改动
 */
function transformBase(mutate) {
  const base = findObject(canvas, BASE_IMAGE_ID)
  if (!base) return
  const before = baseSnapshot(base)
  mutate(base)
  base.setCoords()
  const { width, height, payload, previous } = fitCanvasToBase(canvas, base, before)
  canvasSize.width = width
  canvasSize.height = height
  fitToViewport()
  const forward = { opId: newOpId(), action: 'canvas', targetId: CANVAS_ID, payload }
  pushHistory(forward, { action: 'canvas', targetId: CANVAS_ID, payload: previous })
  emitOperation(forward)
}

/**
 * 按倍率改变整张图片的尺寸
 *
 * 底图、画布、以及所有色块一起等比缩放，缩放后的画布尺寸就是真实图片尺寸。
 * 一次缩放 = 一条 canvas 操作（尺寸 + 底图快照）+ 每个色块一条 update 操作，
 * 撤销时把两组操作按相反顺序再放一遍即可。
 */
function applyPictureScale(ratio) {
  const base = findObject(canvas, BASE_IMAGE_ID)
  if (!base || !originSize.width || !originSize.height) return
  const fromWidth = canvas.getWidth()
  const fromHeight = canvas.getHeight()
  const nextWidth = Math.max(1, Math.round(originSize.width * ratio))
  const nextHeight = Math.max(1, Math.round(originSize.height * ratio))
  const k = nextWidth / fromWidth
  const previousBase = baseSnapshot(base)

  const updateOps = []
  canvas.forEachObject((object) => {
    if (object.customId === BASE_IMAGE_ID || object.internal) {
      return
    }
    const targetId = ensureElementId(object)
    const before = updatePayloadOf(object)
    object.set({
      left: (object.left || 0) * k,
      top: (object.top || 0) * k,
      scaleX: (object.scaleX ?? 1) * k,
      scaleY: (object.scaleY ?? 1) * k
    })
    object.setCoords()
    updateOps.push({ targetId, before, after: updatePayloadOf(object) })
  })

  base.set({
    left: (base.left || 0) * k,
    top: (base.top || 0) * k,
    scaleX: (base.scaleX ?? 1) * k,
    scaleY: (base.scaleY ?? 1) * k
  })
  base.setCoords()
  base.dirty = true

  canvas.setDimensions({ width: nextWidth, height: nextHeight })
  canvasSize.width = nextWidth
  canvasSize.height = nextHeight
  pictureScale.value = ratio
  fitToViewport()

  const forward = [
    { action: 'canvas', targetId: CANVAS_ID, payload: { width: nextWidth, height: nextHeight, base: baseSnapshot(base) } }
  ]
  const inverse = [
    { action: 'canvas', targetId: CANVAS_ID, payload: { width: fromWidth, height: fromHeight, base: previousBase } }
  ]
  updateOps.forEach(({ targetId, before, after }) => {
    forward.push({ action: 'update', targetId, payload: after })
    // 反向要按相反的顺序回放：先还原元素，再回到旧画布尺寸
    inverse.unshift({ action: 'update', targetId, payload: before })
  })
  pushHistory(forward, inverse)
  forward.forEach((op) => emitOperation({ ...op, opId: newOpId() }))
}

function rotate(degree) {
  transformBase((base) => base.rotate((base.angle || 0) + degree))
  // 旋转 90° 后画布长宽互换，基准尺寸也要跟着换，倍率不变
  if (Math.abs(degree) % 180 === 90) {
    const { width, height } = originSize
    originSize.width = height
    originSize.height = width
  }
}

function removeSelected() {
  const active = canvas.getActiveObject()
  if (!active) return
  const objects = active.type === 'activeselection' ? active.getObjects() : [active]
  canvas.discardActiveObject()
  objects.forEach((object) => {
    const targetId = ensureElementId(object)
    const forward = { opId: newOpId(), action: 'remove', targetId }
    pushHistory(forward, { action: 'add', targetId, payload: serializeObject(object) })
    canvas.remove(object)
    emitOperation(forward)
  })
  canvas.requestRenderAll()
  syncSelection()
}

/* ---------------- 画面调整（滤镜） ---------------- */

/**
 * 拖动滑杆：本地预览 + 节流广播
 *
 * 防抖 60ms 是为了不每移动一格就做一次全图运算；
 * 广播单独再节流一次，协作者不用等松手才看到变化（"拖了半天对面没反应"会被当成没同步）。
 * 拖动过程中的广播只同步状态、不进历史，历史在松手时记一条（撤销一步回到拖动前）。
 */
function onFilterInput(key, value) {
  filterState.value[key] = value
  // 本次拖动的起点只在第一次触发时记录，作为整段拖动的撤销基线
  if (!filterDragBase) {
    filterDragBase = { ...committedFilter }
  }
  if (filterTimer) clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    filterTimer = null
    applyFilterLocal()
    const now = Date.now()
    if (now - lastFilterBroadcastAt >= FILTER_BROADCAST_INTERVAL) {
      lastFilterBroadcastAt = now
      broadcastFilter()
    }
  }, 60)
}

function applyFilterLocal() {
  if (!canvas) return
  const base = findObject(canvas, BASE_IMAGE_ID)
  if (!base) return
  applyFilterState(base, filterState.value)
  canvas.requestRenderAll()
}

/** 把当前滤镜参数同步出去（拖动途中用，不记历史） */
function broadcastFilter() {
  if (!canvas) return
  const base = findObject(canvas, BASE_IMAGE_ID)
  if (!base) return
  const next = normalizeFilterState(filterState.value)
  applyFilterState(base, next)
  // 必须存副本：filterState.value 是响应式的，滑杆 / 色调会直接改它的字段，
  // 共用同一个对象的话 committedFilter 会被一起改掉，"有没有变化"就永远判断成"没变"，
  // 表现为调整画面参数时有时不同步
  committedFilter = { ...next }
  canvas.requestRenderAll()
  emitOperation({ opId: newOpId(), action: 'filter', targetId: BASE_IMAGE_ID, payload: { state: next } })
}

function sameFilterState(a, b) {
  const left = normalizeFilterState(a)
  const right = normalizeFilterState(b)
  return (
    left.tone === right.tone &&
    left.brightness === right.brightness &&
    left.contrast === right.contrast &&
    left.saturation === right.saturation &&
    left.blur === right.blur
  )
}

/**
 * 松手 / 切换色调：把最终值同步出去，并把整段拖动记成一步历史
 *
 * 载荷是参数而不是 fabric 滤镜实例，撤销时直接把上一份参数再放一遍即可。
 */
function commitFilter() {
  if (!canvas) return
  const base = findObject(canvas, BASE_IMAGE_ID)
  if (!base) return
  // 撤销的基线是「拖动开始前」，不是最后一次广播出去的中间值
  const before = filterDragBase || { ...committedFilter }
  const next = normalizeFilterState(filterState.value)
  filterState.value = { ...next }
  filterDragBase = null
  if (filterTimer) {
    clearTimeout(filterTimer)
    filterTimer = null
  }
  // 已经广播出去的状态和最终值不同才需要再发一条（拖动途中广播过，松手时往往是同一个值）
  if (!sameFilterState(committedFilter, next)) {
    applyFilterState(base, next)
    committedFilter = { ...next }
    canvas.requestRenderAll()
    emitOperation({ opId: newOpId(), action: 'filter', targetId: BASE_IMAGE_ID, payload: { state: next } })
  }
  if (!sameFilterState(before, next)) {
    const forward = { opId: newOpId(), action: 'filter', targetId: BASE_IMAGE_ID, payload: { state: next } }
    pushHistory(forward, { action: 'filter', targetId: BASE_IMAGE_ID, payload: { state: before } })
  }
}

function resetFilter() {
  filterState.value = { ...DEFAULT_FILTER_STATE }
  commitFilter()
}

/* ---------------- 裁剪 / 打码：拖框 ---------------- */

function handleCanvasMouseDown(opt) {
  if (dragMode) return
  if (cropping.value) {
    startDrag('crop', opt)
    return
  }
  // 点到已有色块：只做选中（色块不允许拖动 / 拉伸），不再开一个新框
  const target = opt.target
  if (target && target.customId !== BASE_IMAGE_ID && !target.internal) {
    return
  }
  if (mosaicMode.value) {
    startDrag('mosaic', opt)
  }
}

function handleCanvasMouseUp() {
  if (dragMode) {
    finishDrag()
  }
}

function toggleCrop() {
  cropping.value = !cropping.value
  if (cropping.value) {
    mosaicMode.value = false
    enterDrawMode('crop')
  } else {
    exitDrawMode()
  }
}

function toggleMosaic() {
  mosaicMode.value = !mosaicMode.value
  if (mosaicMode.value) {
    cropping.value = false
    enterDrawMode('mosaic')
  } else {
    exitDrawMode()
  }
}

/**
 * 进入框选态
 *
 * @param {'crop'|'mosaic'} mode
 * - 裁剪：画布上不能被已有元素打断，先把它们停用；
 * - 打码：已有色块要保持可选中（选中后才能删除 / 改颗粒），
 *   只有"点在空白处"才算要开新框（判断在 handleCanvasMouseDown 里）。
 */
function enterDrawMode(mode) {
  clearDragRect()
  cropRect.value = null
  canvas.selection = false
  canvas.discardActiveObject()
  if (mode === 'crop') {
    setObjectsInteractive(false)
  }
  canvas.defaultCursor = 'crosshair'
  canvas.requestRenderAll()
}

function exitDrawMode() {
  unbindOutsideMouseUp()
  clearDragRect()
  dragMode = null
  dragStart = null
  cropRect.value = null
  setObjectsInteractive(true)
  canvas.selection = true
  canvas.defaultCursor = 'default'
  canvas.requestRenderAll()
}

/**
 * 开始拖框
 *
 * 拖框时鼠标很可能移出画布再松手，而 fabric 只在 canvas 元素上监听 mouseup，
 * 那样选框会一直停在半路。这里额外在 document 上兜一个 mouseup。
 */
function startDrag(mode, opt) {
  const pointer = canvas.getScenePoint(opt.e)
  dragMode = mode
  dragStart = { x: pointer.x, y: pointer.y }
  clearDragRect()
  dragRect = createCropRect(
    canvas,
    dragStart,
    mode === 'mosaic' ? { stroke: '#e23b3b', fill: 'rgba(226,59,59,0.15)' } : {}
  )
  bindOutsideMouseUp()
}

function updateDrag(opt) {
  if (!dragMode || !dragRect || !dragStart) return
  const pointer = canvas.getScenePoint(opt.e)
  // 框不允许超出画布：画布尺寸恒等于图片大小，框到画布外就等于框到了背景，裁出来的内容会对不上
  updateCropRect(dragRect, dragStart, pointer, canvasBounds(canvas))
  canvas.requestRenderAll()
}

async function finishDrag() {
  if (!dragMode) return
  unbindOutsideMouseUp()
  const mode = dragMode
  const rect = dragRect
  dragMode = null
  dragStart = null
  if (!rect) return
  const area = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }

  if (mode === 'crop') {
    if (rect.width > 8 && rect.height > 8) {
      // 保留虚线框作为"当前裁剪区"的可视提示，直到用户点应用或取消
      cropSelection = rect
      cropRect.value = area
      dragRect = null
    } else {
      canvas.remove(rect)
      dragRect = null
    }
    canvas.requestRenderAll()
    return
  }

  // 打码：把框住的区域压成色块贴回原地
  canvas.remove(rect)
  dragRect = null
  canvas.requestRenderAll()
  const clamped = clampAreaToBounds(area, canvasBounds(canvas))
  if (!clamped || clamped.width < 4 || clamped.height < 4) return
  const patch = await createMosaicPatch(canvas, clamped, mosaicBlock.value)
  if (!patch || !canvas) return
  // 交给 object:added 统一广播与记历史，跟其他元素走同一条链路
  canvas.add(patch)
  // 打完就选中：用户马上可以删除它，或者拖右边的「色块」滑杆改这一块的颗粒
  canvas.setActiveObject(patch)
  canvas.requestRenderAll()
}

/* ---------------- 打码：改选中色块的颗粒 ---------------- */

/** 当前选中且确实是马赛克色块的元素 */
function selectedPatch() {
  const active = canvas?.getActiveObject()
  if (!active || active.type === 'activeselection') return null
  return isMosaicPatch(active) ? active : null
}

/**
 * 用新的颗粒值重画一块色块
 *
 * 步骤很关键：**先摘掉旧色块再采样**。色块本身就是一张糊过的图，
 * 直接照着当前画面再糊一次会越来越糊，颗粒也对不上。
 *
 * @param {fabric.Object} object 要重画的色块
 * @param {number} block 色块边长
 * @param {string} [fixedId] 指定新色块的 id（撤销回放时需要用回原来的 id）
 */
async function rebuildPatch(object, block, fixedId) {
  const area = {
    left: object.left,
    top: object.top,
    width: object.width * (object.scaleX ?? 1),
    height: object.height * (object.scaleY ?? 1)
  }
  canvas.remove(object)
  // 同步重绘一次，保证采样拿到的是"没有这块色块"的画面
  canvas.renderAll()
  const clamped = clampAreaToBounds(area, canvasBounds(canvas))
  if (!clamped || !canvas) return null
  const patch = await createMosaicPatch(canvas, clamped, block)
  if (!patch || !canvas) return null
  ensureElementId(patch, fixedId || newElementId())
  canvas.add(patch)
  canvas.setActiveObject(patch)
  canvas.requestRenderAll()
  return patch
}

/** 拖「色块」滑杆：选中了色块就本地实时重画，没选中就只影响下一块 */
function onMosaicBlockInput(value) {
  mosaicBlock.value = value
  if (!selectedPatch()) return
  if (!retuneBase) {
    const active = selectedPatch()
    retuneBase = { targetId: ensureElementId(active), snapshot: serializeObject(active) }
  }
  if (retuneTimer) clearTimeout(retuneTimer)
  retuneTimer = setTimeout(() => {
    retuneTimer = null
    retunePreview(value)
  }, 80)
}

/** 预览：改动画布但不广播、不记历史 */
async function retunePreview(value) {
  const active = selectedPatch()
  if (!active) return
  applyingRemote = true
  try {
    await rebuildPatch(active, value)
  } finally {
    applyingRemote = false
  }
}

/**
 * 松手：确认这次调整
 *
 * 正向 = 删掉调整前的色块 + 加一块新的；反向 = 反过来。
 * 两边都是"删除 + 新增"的组合，撤销 / 重做直接按相反顺序回放即可。
 */
async function commitMosaicBlock() {
  if (retuneTimer) {
    clearTimeout(retuneTimer)
    retuneTimer = null
  }
  const base = retuneBase
  retuneBase = null
  const active = selectedPatch()
  if (!base || !active || !canvas) return
  const beforeId = base.targetId
  const beforeSnapshot = base.snapshot
  applyingRemote = true
  let after
  try {
    // 用最终值再画一次：预览过程中的中间态不进历史
    after = await rebuildPatch(active, mosaicBlock.value)
  } finally {
    applyingRemote = false
  }
  if (!after) return
  const afterId = ensureElementId(after)
  const forward = [
    { action: 'remove', targetId: beforeId },
    { action: 'add', targetId: afterId, payload: serializeObject(after) }
  ]
  const inverse = [
    { action: 'remove', targetId: afterId },
    { action: 'add', targetId: beforeId, payload: beforeSnapshot }
  ]
  pushHistory(forward, inverse)
  forward.forEach((op) => emitOperation({ ...op, opId: newOpId() }))
}

/**
 * 清掉画布上的选框
 *
 * 只负责"框"本身：dragMode / dragStart 的归零交给调用方，
 * 否则"先清空再开新框"的顺序会把刚设好的起点一起清掉。
 */
function clearDragRect() {
  if (dragRect) {
    canvas.remove(dragRect)
    dragRect = null
  }
  if (cropSelection) {
    canvas.remove(cropSelection)
    cropSelection = null
  }
}

function bindOutsideMouseUp() {
  if (outsideMouseUp) return
  outsideMouseUp = () => {
    if (dragMode) {
      finishDrag()
    }
  }
  document.addEventListener('mouseup', outsideMouseUp)
}

function unbindOutsideMouseUp() {
  if (!outsideMouseUp) return
  document.removeEventListener('mouseup', outsideMouseUp)
  outsideMouseUp = null
}

/**
 * 应用裁剪
 *
 * 底图按裁剪区真正裁掉（源图裁剪窗口），其余元素整体平移 (-x,-y)，画布收缩到裁剪区大小。
 */
function applyCrop() {
  const rect = cropRect.value
  if (!rect || !canvas) return
  const result = cropCanvas(canvas, rect)
  if (!result) {
    message.warning('裁剪框没有框到图片内容')
    return
  }
  clearDragRect()
  const { payload, previous } = result
  canvasSize.width = payload.width
  canvasSize.height = payload.height
  // 裁剪改掉了图片本身，基准尺寸跟着改成裁剪所得，倍率回到 100%
  originSize.width = payload.width
  originSize.height = payload.height
  pictureScale.value = 1
  fitToViewport()
  const forward = { opId: newOpId(), action: 'canvas', targetId: CANVAS_ID, payload }
  pushHistory(forward, { action: 'canvas', targetId: CANVAS_ID, payload: previous })
  emitOperation(forward)
  cropRect.value = null
  cropping.value = false
  setObjectsInteractive(true)
  canvas.selection = true
  canvas.requestRenderAll()
}

/* ---------------- 撤销重做 ---------------- */

/**
 * 本地执行一组操作：广播出去，同时立刻应用到自己的画布
 *
 * 单个操作（拖动、删除、滤镜）传对象即可；像"整图缩放"这种会同时改画布尺寸
 * 和每个元素位置的动作，一次要放好几条，按顺序依次应用。
 *
 * @param {Object|Object[]} ops { action, targetId, payload }
 */
function runLocal(ops) {
  if (!canvas) return
  const list = (Array.isArray(ops) ? ops : [ops]).map((op) => ({ ...op, opId: newOpId() }))
  list.forEach((op) => emitOperation(op))
  applyingRemote = true
  ;(async () => {
    for (const op of list) {
      await applyOp(op)
    }
  })().finally(() => {
    applyingRemote = false
  })
}

/**
 * 记一条本地历史
 *
 * 正向、反向两份都要留：撤销放反向、重做放正向，两边都是普通操作，
 * 接收端不需要知道"这是不是一次撤销"。
 * 一旦有新操作，原来的可重做链路就作废（跟常见编辑器一致）。
 *
 * @param {Object|Object[]} forward
 * @param {Object|Object[]} inverse
 */
function pushHistory(forward, inverse) {
  const first = Array.isArray(forward) ? forward[0] : forward
  history.value.push({ targetId: first?.targetId, forward, inverse })
  if (redoStack.value.length) {
    redoStack.value = []
  }
}

function undo() {
  const entry = history.value.pop()
  if (!entry) return
  redoStack.value.push(entry)
  runLocal(entry.inverse)
}

function redo() {
  const entry = redoStack.value.pop()
  if (!entry) return
  history.value.push(entry)
  runLocal(entry.forward)
}

/* ---------------- 协作 ---------------- */

/**
 * 建立协作连接
 *
 * 只有团队空间的图片才走这条路：非协作场景不建 WebSocket，既不用占一条长连接，
 * 也不会在后端凭空生成一个只有自己的协作房间。
 */
function connect() {
  if (!props.collaborative || !props.picture?.id) return
  socket = createCollabSocket({
    pictureId: props.picture.id,
    onMessage: handleSocketMessage,
    onStatusChange: (status) => {
      collabOpen.value = status === 'open'
    }
  })
}

function emitOperation(op) {
  opCount.value += 1
  if (op?.opId) {
    selfOpIds.add(op.opId)
    // 只是用来判断回声，不需要长期留存
    if (selfOpIds.size > 300) {
      selfOpIds.clear()
    }
  }
  socket?.send('op', op)
}

/**
 * 上行光标：统一按场景坐标发送，接收端各用自己的视口换算，缩放不同也不会错位
 */
function trackPointer(opt) {
  // 非协作模式下没有上行通道，别做无谓的坐标换算
  if (!socket) return
  const now = Date.now()
  if (now - lastPointerAt < 60) return
  lastPointerAt = now
  const pointer = canvas.getScenePoint(opt.e)
  socket?.send('cursor', { x: pointer.x, y: pointer.y })
}

async function handleSocketMessage(message) {
  if (!canvas) return
  const { type, payload } = message
  if (type === 'snapshot') {
    await applySnapshot(payload)
    return
  }
  if (type === 'op_broadcast') {
    applyingRemote = true
    try {
      await applyOp(payload)
      opCount.value += 1
    } finally {
      applyingRemote = false
    }
    return
  }
  if (type === 'members') {
    members.value = payload?.members || []
    selfId.value = payload?.selfId || ''
    members.value = members.value.map((member) => ({
      ...member,
      self: member.userId === selfId.value
    }))
    return
  }
  if (type === 'cursor_broadcast') {
    updateRemoteCursor(payload)
    return
  }
  if (type === 'saved') {
    message.info('协作者已保存，正在同步最新版本')
    await reloadBase(payload)
    return
  }
  if (type === 'error') {
    message.warning(typeof payload === 'string' ? payload : '协作服务返回错误')
  }
}

/**
 * 加入房间时补齐别人已经做过的编辑，保证自己看到的内容和大家一致
 */
async function applySnapshot(state) {
  const operations = state?.operations || []
  if (!operations.length) return
  applyingRemote = true
  try {
    for (const op of operations) {
      await applyOperation(canvas, op)
    }
    syncFilterFromBase()
    canvasSize.width = canvas.getWidth()
    canvasSize.height = canvas.getHeight()
    fitToViewport()
    opCount.value += operations.length
  } finally {
    applyingRemote = false
  }
}

function updateRemoteCursor(payload) {
  if (!payload?.userId || payload.userId === selfId.value) return
  if (!canvas) return
  // 收到的是画布逻辑坐标，先按视口变换换算成画布像素坐标；
  // 屏幕位置在 refreshCursorPositions 里统一换算（要考虑缩放与容器滚动）
  const scene = fabric.util.transformPoint(
    new fabric.Point(payload.x || 0, payload.y || 0),
    canvas.viewportTransform
  )
  const others = remoteCursors.value.filter((item) => item.userId !== payload.userId)
  others.push({
    userId: payload.userId,
    userName: payload.userName || '协作者',
    color: payload.color || '#1677ff',
    // 保留画布像素坐标：容器滚动 / 视图缩放后要用它重新换算屏幕位置
    sceneX: scene.x,
    sceneY: scene.y,
    screenX: 0,
    screenY: 0
  })
  remoteCursors.value = others
  refreshCursorPositions()
  setTimeout(() => {
    remoteCursors.value = remoteCursors.value.filter((item) => item.userId !== payload.userId)
  }, 3000)
}

/** 容器滚动或视图缩放后，按最新布局重算所有远端光标的屏幕位置 */
function refreshCursorPositions() {
  const holder = canvasHolder.value
  const el = canvasEl.value
  if (!holder || !el || !remoteCursors.value.length) return
  const scale = viewScale.value || 1
  const holderBox = holder.getBoundingClientRect()
  const canvasBox = el.getBoundingClientRect()
  const dx = canvasBox.left - holderBox.left
  const dy = canvasBox.top - holderBox.top
  remoteCursors.value = remoteCursors.value.map((cursor) => ({
    ...cursor,
    screenX: cursor.sceneX * scale + dx,
    screenY: cursor.sceneY * scale + dy
  }))
}

/**
 * 别人保存后：服务端已把原图覆盖，本地需要换成新的基础图，并清空草稿层
 */
async function reloadBase() {
  const pictureId = props.picture?.id
  if (!pictureId || !canvas) return
  const url = await fetchImageObjectUrl(pictureId)
  if (!url || !canvas) {
    if (url) URL.revokeObjectURL(url)
    return
  }
  const objects = canvas.getObjects().filter((object) => object.customId !== BASE_IMAGE_ID)
  objects.forEach((object) => canvas.remove(object))
  const image = await loadBaseImage(canvas, url)
  if (!canvas) return
  canvas.add(image)
  // 别人保存后画布尺寸可能已变（比如他裁剪过），跟着收敛到新底图
  const nextWidth = image.width || canvasSize.width
  const nextHeight = image.height || canvasSize.height
  if (Math.round(canvas.getWidth()) !== Math.round(nextWidth) ||
      Math.round(canvas.getHeight()) !== Math.round(nextHeight)) {
    canvas.setDimensions({ width: nextWidth, height: nextHeight })
  }
  canvasSize.width = nextWidth
  canvasSize.height = nextHeight
  originSize.width = nextWidth
  originSize.height = nextHeight
  pictureScale.value = 1
  // 新底图已经包含保存时的滤镜效果，本地滤镜参数回到默认
  filterState.value = { ...DEFAULT_FILTER_STATE }
  committedFilter = { ...DEFAULT_FILTER_STATE }
  filterDragBase = null
  lastFilterBroadcastAt = 0
  canvas.requestRenderAll()
  fitToViewport()
  history.value = []
  redoStack.value = []
  opCount.value = 0
  cropping.value = false
  mosaicMode.value = false
  cropRect.value = null
  dragMode = null
  dragStart = null
  dragRect = null
  cropSelection = null
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
  }
  objectUrl = url
}

/* ---------------- 保存 ---------------- */

async function handleSave() {
  if (!canvas || saving.value) return
  const picture = props.picture
  if (!picture?.id) return
  saving.value = true
  try {
    const format = String(picture.picFormat || 'png').toLowerCase()
    const exportFormat = ['jpg', 'jpeg'].includes(format) ? 'jpeg' : 'png'
    const { blob, width, height } = await exportCanvasBlob(canvas, {
      format: exportFormat,
      quality: 0.92
    })
    const fileName = `${picture.picName || 'edited'}.${exportFormat === 'jpeg' ? 'jpg' : 'png'}`
    const file = new File([blob], fileName, { type: `image/${exportFormat}` })
    const formData = new FormData()
    formData.append('file', file)
    const uploaded = await uploadPicture(formData)

    await updatePicture({
      id: picture.id,
      url: uploaded.url,
      thumbnailUrl: uploaded.thumbnailUrl,
      picName: picture.picName,
      introduction: picture.introduction,
      categoryId: picture.categoryId,
      tagIds: Array.isArray(picture.tags) ? picture.tags.map((v) => String(v)) : undefined,
      picSize: uploaded.picSize ?? blob.size,
      picWidth: uploaded.picWidth ?? width,
      picHeight: uploaded.picHeight ?? height,
      picScale: width && height ? Number((width / height).toFixed(2)) : undefined,
      picFormat: uploaded.picFormat,
      picColor: uploaded.picColor
    })

    // 通知房间内其他人：图片已被覆盖，草稿失效
    socket?.send('save', {
      url: uploaded.url,
      thumbnailUrl: uploaded.thumbnailUrl,
      picWidth: uploaded.picWidth,
      picHeight: uploaded.picHeight
    })
    message.success('修改已保存到原图')
    emit('saved')
  } catch (e) {
    /* 拦截器已提示具体错误 */
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}

function teardown() {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
  unbindOutsideMouseUp()
  if (filterTimer) {
    clearTimeout(filterTimer)
    filterTimer = null
  }
  filterDragBase = null
  selfOpIds.clear()
  if (retuneTimer) {
    clearTimeout(retuneTimer)
    retuneTimer = null
  }
  retuneBase = null
  resizeObserver?.disconnect()
  resizeObserver = null
  socket?.close()
  socket = null
  collabOpen.value = false
  selfId.value = ''
  members.value = []
  remoteCursors.value = []
  history.value = []
  redoStack.value = []
  opCount.value = 0
  beforeModify = new Map()
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
  if (canvas) {
    canvas.dispose()
    canvas = null
  }
  dragMode = null
  dragStart = null
  dragRect = null
  cropSelection = null
  ready.value = false
  cropping.value = false
  mosaicMode.value = false
  cropRect.value = null
}

onBeforeUnmount(teardown)
</script>

<style lang="less">
/* 让弹窗本身跟着视口走：内容区用 flex 撑满剩余高度，避免出现整页滚动条 */
.editor-modal-wrap {
  overflow: hidden;
}

.editor-modal-wrap .ant-modal {
  max-width: 96vw;
  padding-bottom: 0;
}

.editor-modal-wrap .ant-modal-content {
  display: flex;
  flex-direction: column;
  /* 必须给实高：只给 max-height 时内容区高度由子元素决定，flex:1 拿不到空间会塌缩 */
  height: calc(100vh - 32px);
  max-height: calc(100vh - 32px);
  overflow: hidden;
}

.editor-modal-wrap .ant-modal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}
</style>

<style scoped lang="less">
.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toolbar {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.zoom-text {
  display: inline-block;
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.editor-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.canvas-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.canvas-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.canvas-holder {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  /* 正常情况下画布不会超出容器；放大到极限时留一个滚动条兜底，避免画面被裁掉看不到 */
  overflow: auto;
  background: var(--checker);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

/*
 * 远端光标的覆盖层：盖在画板上方但不参与滚动，overflow 截掉超出边缘的名牌，
 * 避免把滚动区撑出滚动条导致画面抖动
 */
.cursor-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
}

/*
 * 用 margin:auto 居中而不是 align-items/justify-content：
 * 后者在内容超出容器时会把起始边裁掉且滚不过去，放大后图片的左/上部分就看不到了。
 * 同时不让 fabric 的画布被 flex 压缩，否则指针坐标会错位导致拖不动。
 */
.canvas-holder :deep(.canvas-container) {
  margin: auto;
  flex-shrink: 0;
}

.canvas-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mask);
}

.canvas-footer {
  padding-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.remote-cursor {
  position: absolute;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  gap: 3px;
  transition: left 0.08s linear, top 0.08s linear;
}

.cursor-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #fff;
}

.cursor-name {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 16px;
  color: #fff;
  white-space: nowrap;
}

.side-panel {
  width: 248px;
  flex-shrink: 0;
  /* 上下留白与画板区（12px）一致，让侧栏卡片和画板上下边缘对齐；
     右侧留白交给滚动容器，好让它变成「滚动条与卡片的间距」 */
  padding: 12px 0 12px 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/*
 * 滚动条挂在这一层而不是 .side-panel：
 * 滚动容器自身的上下 padding 会跟着内容一起滚走，卡片就能滚到容器最顶端、吃掉顶部留白，
 * 顶边对齐也跟着没了。这里让外层负责留白、内层负责滚动，滚动条始终只在卡片区那一截。
 * 水平方向的 padding 不会随垂直滚动跑掉，所以卡片与滚动条之间的间距放这里是安全的。
 */
.side-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: 8px;
  /* Firefox：细条 + 默认透明 */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

/* 滚动条平时隐身，鼠标移到侧栏上才淡出来，width 始终占位所以不会抖动 */
.side-scroll::-webkit-scrollbar {
  width: 6px;
}

.side-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.side-scroll::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 999px;
  transition: background 0.18s ease;
}

.side-scroll:hover::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}

.side-scroll:hover::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.side-scroll:hover {
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

@media (max-width: 1100px) {
  .side-panel {
    width: 196px;
  }
}

.panel-block {
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
}

/* 最后一张卡片拉伸填满剩余高度，底边与画板对齐 */
.panel-block:last-child {
  flex: 1;
  margin-bottom: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 10px;
}

.panel-hint {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.panel-empty {
  font-size: 12px;
  color: var(--text-tertiary);
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.member-name {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 0;
  flex: 1;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.prop-label {
  font-size: 12px;
  color: var(--text-secondary);
  width: 42px;
  flex-shrink: 0;
}
</style>
