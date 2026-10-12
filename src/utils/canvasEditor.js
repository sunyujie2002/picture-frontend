import * as fabric from 'fabric'

/**
 * 画布编辑引擎
 *
 * 设计前提：对象级并发。
 * 画布上的每个元素都带一个全局 customId，操作以元素为单位广播：
 * 不同元素各自广播互不影响；同一元素按服务端序号后写覆盖先写。
 *
 * 本地编辑与远端同步共用 {@link applyOperation} 这一个入口，
 * 保证无论操作来自自己还是别人，落到画布上的结果完全一致。
 */

/** 底图对象的固定 id：整图的旋转、缩放都作用在它身上，因此也是可同步的元素 */
export const BASE_IMAGE_ID = '__base__'

/** 画布自身的 id：裁剪、尺寸变化这类整体操作挂在它上面 */
export const CANVAS_ID = '__canvas__'

let seed = 0

/**
 * 生成本地唯一的操作 id
 * 客户端生成而非服务端下发，是为了让「同一条操作重复提交」能被幂等识别（重连重试场景）
 */
export function newOpId() {
  seed += 1
  return `op_${Date.now()}_${seed}_${Math.random().toString(36).slice(2, 8)}`
}

export function newElementId() {
  seed += 1
  return `el_${Date.now()}_${seed}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 读取 / 补写元素的协作 id
 * <p>fabric 没有内置业务 id，所有元素靠它参与到协作里。
 */
export function ensureElementId(object, id) {
  if (!object.customId) {
    object.customId = id || newElementId()
  }
  return object.customId
}

export function findObject(canvas, targetId) {
  if (!canvas || !targetId) {
    return null
  }
  return canvas.getObjects().find((item) => item.customId === targetId) || null
}

const SYNC_PROPS = [
  'left',
  'top',
  'angle',
  'scaleX',
  'scaleY',
  'skewX',
  'skewY',
  'flipX',
  'flipY',
  'opacity',
  'visible',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeLineCap',
  'strokeLineJoin',
  'text',
  'width',
  'height',
  'rx',
  'ry',
  'radius',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'textAlign',
  'underline',
  'lineHeight'
]

/**
 * 抽取需要同步的属性
 * 只挑扁平标量，不整序列化：既省带宽，也避免把 clipPath / filters 这类嵌套结构卷进来导致还原失败
 */
export function updatePayloadOf(object) {
  const payload = {}
  SYNC_PROPS.forEach((key) => {
    const value = object[key]
    if (value !== undefined) {
      payload[key] = value
    }
  })
  // 自由画笔的路径数据本身就是它形状的本体，跟着更新一起同步，避免放大后重绘失真
  if (object.type === 'path' && object.path) {
    payload.path = object.path
  }
  return payload
}

/**
 * 对象完整快照（用于新增元素的同步与删除后的还原）
 */
export function serializeObject(object) {
  // imageSmoothing 不在 fabric 默认序列化列表里，而马赛克全靠它保持硬边色块，必须显式带上；
  // mosaic 是本项目的自定义标记，用来在协作端把色块重新锁回"不可拖动"的状态
  const raw = object.toObject(['customId', 'imageSmoothing', 'mosaic'])
  // V6 会把 clipPath / filters 等嵌套对象带上，这类结构跨端还原成本高且当前用不到，直接剔除
  delete raw.clipPath
  delete raw.filters
  return raw
}

/**
 * 应用一条操作到画布
 *
 * @param {fabric.Canvas} canvas 目标画布
 * @param {Object} op 操作对象 { action, targetId, payload }
 * @returns {Promise<void>}
 */
export async function applyOperation(canvas, op) {
  if (!canvas || !op) {
    return
  }
  switch (op.action) {
    case 'add':
      await applyAdd(canvas, op)
      break
    case 'update':
      applyUpdate(canvas, op)
      break
    case 'remove':
      applyRemove(canvas, op)
      break
    case 'bring':
      applyBring(canvas, op)
      break
    case 'canvas':
      await applyCanvasChange(canvas, op)
      break
    case 'filter':
      applyFilter(canvas, op)
      break
    case 'undo':
      // 撤销的本质是把反向操作再放一遍，语义统一，接收端无需区分"这是不是撤销"
      if (op.payload) {
        await applyOperation(canvas, { ...op.payload, action: op.payload.action })
      }
      break
    default:
      break
  }
  canvas.requestRenderAll()
}

async function applyAdd(canvas, op) {
  if (findObject(canvas, op.targetId)) {
    // 幂等：已经有了就不再加（例如本端已应用过同一条重复消息）
    return
  }
  const snapshot = op.payload
  if (!snapshot) {
    return
  }
  const restored = await enlivenOne(snapshot)
  if (!restored) {
    return
  }
  restored.customId = op.targetId
  // 底图无论从哪条路径进来都必须保持锁定，否则协作端还原后会变成可拖动元素
  if (op.targetId === BASE_IMAGE_ID) {
    lockBaseObject(restored)
  }
  // 色块同理：锁定属性不一定随序列化带过来，这里按标记再锁一次
  if (restored.mosaic) {
    lockMosaicPatch(restored)
    // 同步过来的是未处理的原始像素，要按底图当下的画面参数补一次滤镜，
    // 否则别人在灰度 / 调色之后新建的色块到这边还是原色，看着像"这块没被调色"
    const base = findObject(canvas, BASE_IMAGE_ID)
    const filters = buildFilters(base?.filterState || DEFAULT_FILTER_STATE)
    if (filters.length) {
      restored.filters = filters
      restored.applyFilters()
    }
  }
  canvas.add(restored)
}

function applyUpdate(canvas, op) {
  const object = findObject(canvas, op.targetId)
  if (!object || !op.payload) {
    return
  }
  const { customId, ...patch } = op.payload
  object.set(patch)
  object.setCoords()
}

function applyRemove(canvas, op) {
  const object = findObject(canvas, op.targetId)
  if (!object) {
    return
  }
  canvas.remove(object)
}

function applyBring(canvas, op) {
  const object = findObject(canvas, op.targetId)
  if (!object) {
    return
  }
  switch (op.payload?.command) {
    case 'forward':
      canvas.bringObjectForward(object)
      break
    case 'backward':
      canvas.sendObjectBackwards(object)
      break
    case 'front':
      canvas.bringObjectToFront(object)
      break
    case 'back':
      canvas.sendObjectToBack(object)
      break
    default:
      break
  }
}

/**
 * 记录所有可同步元素的**绝对**位置
 *
 * 裁剪 / 旋转会整体挪动画布上的元素，广播时只能带绝对值，不能带位移量：
 * 服务端会把操作回发给发起者本人（所有客户端都走同一条广播路径），
 * 本地又已经先执行过一次，带位移量就会被平移两次，元素一路飘到左上角。
 *
 * @param {fabric.Canvas} canvas
 * @returns {Array<{ targetId: string, left: number, top: number }>}
 */
export function elementPositions(canvas) {
  const list = []
  if (!canvas) {
    return list
  }
  canvas.forEachObject((object) => {
    if (!object.customId || object.customId === BASE_IMAGE_ID || object.internal) {
      return
    }
    list.push({ targetId: object.customId, left: object.left || 0, top: object.top || 0 })
  })
  return list
}

/** 按绝对位置还原元素（重复应用结果一致） */
function applyElementPositions(canvas, elements) {
  if (!Array.isArray(elements)) {
    return
  }
  elements.forEach(({ targetId, left, top }) => {
    const object = findObject(canvas, targetId)
    if (!object) {
      return
    }
    object.set({ left, top })
    object.setCoords()
  })
}

/**
 * 整体变更（裁剪结果、画布尺寸）：重建底图并同步视口
 */
async function applyCanvasChange(canvas, op) {
  const next = op.payload
  if (!next) {
    return
  }
  if (next.width > 0 && next.height > 0) {
    if (next.elements) {
      applyElementPositions(canvas, next.elements)
    } else if (typeof next.dx === 'number' || typeof next.dy === 'number') {
      // 旧版载荷（位移量）的兼容分支，新操作一律走上面的绝对位置
      canvas.forEachObject((object) => {
        object.set({ left: (object.left || 0) + (next.dx || 0), top: (object.top || 0) + (next.dy || 0) })
        object.setCoords()
      })
    }
    canvas.setDimensions({ width: next.width, height: next.height })
  }
  const base = findObject(canvas, BASE_IMAGE_ID)
  if (base && next.base) {
    // 整图变换 / 裁剪都靠这份快照还原，必须整体覆盖（含 cropX/cropY/width/height）
    base.set(next.base)
    base.setCoords()
    base.dirty = true
    // 源图裁剪窗口变了，滤镜结果要按新窗口重算（否则撤销裁剪后画面还是旧的滤镜缓存）
    reapplyFilters(base)
  }
  if (next.viewportTransform) {
    canvas.setViewportTransform(next.viewportTransform)
  }
}

/**
 * 整图滤镜
 *
 * 同步的载荷是「可调参数」而不是 fabric 滤镜实例：
 * 滤镜实例挂着 WebGL 纹理与函数，无法 JSON 化，而参数既能广播也能直接用于撤销。
 */
function applyFilter(canvas, op) {
  const base = findObject(canvas, op.targetId || BASE_IMAGE_ID)
  if (!base || !op.payload) {
    return
  }
  applyFilterState(base, op.payload.state)
}

/**
 * 底图的同步字段快照
 *
 * 旋转、缩放、裁剪都会改底图本身（不只是位置），撤销与协作端要能原样还原，
 * 所以把这些字段一起打包：位置 + 变换 + 源图裁剪窗口。
 */
export function baseSnapshot(base) {
  if (!base) {
    return null
  }
  return {
    left: base.left,
    top: base.top,
    angle: base.angle,
    scaleX: base.scaleX,
    scaleY: base.scaleY,
    width: base.width,
    height: base.height,
    cropX: base.cropX,
    cropY: base.cropY,
    // 滤镜同样属于底图状态：裁剪 / 旋转的撤销必须连它一起还原，协作端才不会"图回来了但颜色没回来"
    filterState: base.filterState ? { ...base.filterState } : null
  }
}

/* ---------------- 画面调整（灰度 / 黑白 / 亮度 / 对比度 / 饱和度 / 模糊） ---------------- */

/**
 * 滤镜参数的默认值
 *
 * 取值范围一律用「-100 ~ 100 的整数」这种与人直觉一致的量纲，
 * 落到 fabric 时再除以 100 换算成它要求的 -1 ~ 1。
 */
export const DEFAULT_FILTER_STATE = {
  /** 色调：origin 原图 / gray 灰度 / bw 黑白 */
  tone: 'origin',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0
}

const TONE_LIST = ['origin', 'gray', 'bw']

/** 夹到合法范围并取整，避免浮点与越界值在协作端还原时产生差异 */
export function normalizeFilterState(state) {
  const source = state || {}
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)))
  return {
    tone: TONE_LIST.includes(source.tone) ? source.tone : 'origin',
    brightness: clamp(source.brightness, -100, 100),
    contrast: clamp(source.contrast, -100, 100),
    saturation: clamp(source.saturation, -100, 100),
    blur: clamp(source.blur, 0, 100)
  }
}

/** 参数 → fabric 滤镜链；中性值（0）直接跳过，省一次全图运算 */
function buildFilters(state) {
  const next = normalizeFilterState(state)
  const list = []
  if (next.tone === 'gray') {
    list.push(new fabric.filters.Grayscale())
  } else if (next.tone === 'bw') {
    list.push(new fabric.filters.BlackWhite())
  }
  if (next.brightness) {
    list.push(new fabric.filters.Brightness({ brightness: next.brightness / 100 }))
  }
  if (next.contrast) {
    list.push(new fabric.filters.Contrast({ contrast: next.contrast / 100 }))
  }
  if (next.saturation) {
    list.push(new fabric.filters.Saturation({ saturation: next.saturation / 100 }))
  }
  if (next.blur) {
    list.push(new fabric.filters.Blur({ blur: next.blur / 100 }))
  }
  return list
}

/**
 * 把一组滤镜参数落到底图上，并让所有马赛克色块跟着一起变
 *
 * 色块是独立的小图，滤镜只加在底图上的话，切灰度 / 调亮度时画面变了、色块还是原色，
 * 看着像"没生效"。色块保存的是**未被滤镜处理过的原始像素**，因此这里直接套同一组滤镜
 * 就能和底图保持一致，也不会像"在已处理画面上再叠一层"那样越调越偏。
 *
 * @param {fabric.FabricImage} base
 * @param {Object} [state] 滤镜参数；缺省视为恢复原图
 */
export function applyFilterState(base, state) {
  if (!base) return
  const next = normalizeFilterState(state)
  // 存副本：外界（界面滑杆、快照）拿着同一份对象时，一改字段就等于改了底图状态
  base.filterState = { ...next }
  base.filters = buildFilters(next)
  base.applyFilters()
  base.setCoords()
  base.dirty = true
  syncMosaicFilters(base.canvas, next)
}

/**
 * 让所有马赛克色块套上同一组滤镜
 *
 * 每个色块都要新建自己的滤镜实例：fabric 的滤镜是带状态的对象，多个元素共用同一份实例
 * 在 WebGL 后端下会互相踩到纹理缓存。
 */
function syncMosaicFilters(canvas, state) {
  if (!canvas) return
  canvas.forEachObject((object) => {
    if (!isMosaicPatch(object)) {
      return
    }
    object.filters = buildFilters(state)
    object.applyFilters()
    object.dirty = true
  })
}

/**
 * 底图的源图窗口变化（裁剪、撤销裁剪）后按当前参数重算滤镜
 *
 * fabric 的滤镜结果是一份像素缓存，裁剪改的是 cropX/cropY/width/height，
 * 不重算的话画面会停在上一次的滤镜结果上。
 */
export function reapplyFilters(base) {
  if (!base) return
  const state = base.filterState || DEFAULT_FILTER_STATE
  base.filters = buildFilters(state)
  base.applyFilters()
  base.dirty = true
  // 色块同样是"原始像素 + 滤镜"，底图重算时它们也要跟着重算
  syncMosaicFilters(base.canvas, state)
}

/** 把裁剪框收敛成整数像素区域，避免累积小数导致来回裁剪后错位 */
function normalizeArea(rect) {
  const left = Math.round(rect.left || 0)
  const top = Math.round(rect.top || 0)
  return {
    left,
    top,
    width: Math.max(1, Math.round(rect.width || 0)),
    height: Math.max(1, Math.round(rect.height || 0))
  }
}

/**
 * 把一组场景坐标点换算到底图的局部坐标系，并返回它们的包围范围
 *
 * 注意 fabric 的变换矩阵以对象**中心**为局部原点，不能直接把逆变换结果当源图坐标用；
 * 这里只取相对范围，再用"底图自身包围盒"做基准，避免依赖原点语义。
 */
function localBounds(base, inverse, points) {
  const mapped = points.map(([x, y]) =>
    fabric.util.transformPoint(new fabric.Point(x, y), inverse)
  )
  const xs = mapped.map((point) => point.x)
  const ys = mapped.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
}

function cornersOf(rect) {
  return [
    [rect.left, rect.top],
    [rect.left + rect.width, rect.top],
    [rect.left, rect.top + rect.height],
    [rect.left + rect.width, rect.top + rect.height]
  ]
}

/**
 * 真正裁掉底图
 *
 * 不能只靠"缩小画布把多余部分挡在外面"：那样底图还是完整的，
 * 一旦后续旋转 / 缩放（画布要跟着图片变）被裁掉的部分就会整块跑回来。
 * 这里把裁剪框逆变换回原图像素窗口，用 cropX / cropY / width / height 落到底图上，
 * 底图从此就只有裁剪区这么大。
 *
 * @param {fabric.FabricImage} base 底图
 * @param {{left:number,top:number,width:number,height:number}} area 裁剪区（场景坐标）
 */
function cropBaseToArea(base, area) {
  const inverse = fabric.util.invertTransform(base.calcTransformMatrix())
  const box = base.getBoundingRect()
  const baseLocal = localBounds(base, inverse, cornersOf(box))
  const areaLocal = localBounds(base, inverse, cornersOf(area))
  const scaleX = base.scaleX || 1
  const scaleY = base.scaleY || 1
  // 裁剪区相对底图左上角的偏移（底图自身包围盒作为基准，抵消局部原点在中心的影响）
  let cropX = (base.cropX || 0) + (areaLocal.minX - baseLocal.minX) / scaleX
  let cropY = (base.cropY || 0) + (areaLocal.minY - baseLocal.minY) / scaleY
  let width = Math.max(1, (areaLocal.maxX - areaLocal.minX) / Math.abs(scaleX))
  let height = Math.max(1, (areaLocal.maxY - areaLocal.minY) / Math.abs(scaleY))

  // 裁剪框拖到图片外时裁出来会是空白，这里夹回原图范围
  const element = typeof base.getElement === 'function' ? base.getElement() : null
  const naturalWidth = element?.naturalWidth || element?.width || 0
  const naturalHeight = element?.naturalHeight || element?.height || 0
  if (naturalWidth && naturalHeight) {
    cropX = Math.max(0, Math.min(cropX, naturalWidth - 1))
    cropY = Math.max(0, Math.min(cropY, naturalHeight - 1))
    width = Math.min(width, naturalWidth - cropX)
    height = Math.min(height, naturalHeight - cropY)
  }

  base.set({ cropX, cropY, width, height, scaleX: 1, scaleY: 1 })
  base.setCoords()
  // 换了新的源窗口后包围盒会变，把它重新对齐到裁剪框左上角
  const nextBox = base.getBoundingRect()
  base.set({
    left: (base.left || 0) + (area.left - nextBox.left),
    top: (base.top || 0) + (area.top - nextBox.top)
  })
  base.setCoords()
  base.dirty = true
}

/**
 * 建一个裁剪提示框
 *
 * @param {fabric.Canvas} canvas
 * @param {{x:number,y:number}} start 起点（场景坐标）
 * @returns {fabric.Rect} 标记了 internal，不会被同步出去
 */
export function createCropRect(canvas, start, options = {}) {
  const rect = new fabric.Rect({
    left: start.x,
    top: start.y,
    width: 0,
    height: 0,
    fill: options.fill || 'rgba(22,119,255,0.15)',
    stroke: options.stroke || '#1677ff',
    strokeWidth: 1,
    strokeUniform: true,
    strokeDashArray: [4, 3],
    selectable: false,
    evented: false
  })
  rect.internal = true
  canvas.add(rect)
  return rect
}

/**
 * 让裁剪框跟随鼠标：从起点到当前点构成的矩形
 *
 * 框不允许超出 bounds（画布范围）：画布尺寸恒等于图片大小，
 * 拖到画布外就等于框到了棋盘格背景，裁出来的区域会和框选位置对不上。
 *
 * @param {Object} [bounds] { left, top, width, height } 允许的范围，缺省不限制
 */
export function updateCropRect(rect, start, pointer, bounds) {
  const clampX = (x) => (bounds ? Math.min(Math.max(x, bounds.left), bounds.left + bounds.width) : x)
  const clampY = (y) => (bounds ? Math.min(Math.max(y, bounds.top), bounds.top + bounds.height) : y)
  const from = { x: clampX(start.x), y: clampY(start.y) }
  const to = { x: clampX(pointer.x), y: clampY(pointer.y) }
  rect.set({
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y)
  })
  rect.setCoords()
}

/** 画布可视范围：裁剪框与马赛克框都不能越过它 */
export function canvasBounds(canvas) {
  return { left: 0, top: 0, width: canvas.getWidth(), height: canvas.getHeight() }
}

/** 把一个区域收敛到 bounds 之内；完全在外则返回 null */
export function clampAreaToBounds(area, bounds) {
  const left = Math.max(area.left, bounds.left)
  const top = Math.max(area.top, bounds.top)
  const right = Math.min(area.left + area.width, bounds.left + bounds.width)
  const bottom = Math.min(area.top + area.height, bounds.top + bounds.height)
  if (right - left < 1 || bottom - top < 1) {
    return null
  }
  return normalizeArea({ left, top, width: right - left, height: bottom - top })
}

/**
 * 应用裁剪：底图真正裁掉 + 所有元素整体平移 + 画布收缩到裁剪区
 *
 * @param {fabric.Canvas} canvas
 * @param {{left:number,top:number,width:number,height:number}} rect 裁剪框（场景坐标）
 * @returns {{ payload: Object, previous: Object }|null} payload 可直接作为 canvas 操作广播，
 *          previous 用于撤销；框与图片无重叠时返回 null
 */
export function cropCanvas(canvas, rect) {
  const base = findObject(canvas, BASE_IMAGE_ID)
  // 画布尺寸恒等于图片大小，所以"不超出画布"就是"不超出图片"；
  // 这里再夹一次作为兜底（协作端、撤销路径传来的框未必经过界面拖拽）
  const visible = base ? base.getBoundingRect() : canvasBounds(canvas)
  const area = clampAreaToBounds(normalizeArea(rect), visible)
  if (!area) {
    // 框和图片完全没重叠，裁不了
    return null
  }
  const previous = {
    width: canvas.getWidth(),
    height: canvas.getHeight(),
    // 撤销要回到"裁剪前的绝对布局"：元素位置、底图快照、画布尺寸都得是改动前的
    elements: elementPositions(canvas),
    base: baseSnapshot(base),
    // 标记这是裁剪：接收端据此把"缩放基准尺寸"换成裁剪所得
    crop: true
  }
  if (base) {
    cropBaseToArea(base, area)
  }
  canvas.forEachObject((object) => {
    object.set({ left: (object.left || 0) - area.left, top: (object.top || 0) - area.top })
    object.setCoords()
  })
  canvas.setDimensions({ width: area.width, height: area.height })
  canvas.requestRenderAll()
  return {
    previous,
    payload: {
      width: area.width,
      height: area.height,
      elements: elementPositions(canvas),
      base: baseSnapshot(base),
      crop: true
    }
  }
}

/**
 * 采样前临时摘掉画布上所有元素的滤镜，返回一个把它们原样装回去的函数
 *
 * 打码要采的是"原始像素"：色块本身会跟底图一样套上当前滤镜，
 * 若采的是已经调过色的画面，之后每次调整都会再叠一层，颜色会和底图脱节。
 */
function clearFiltersForSampling(canvas) {
  const backup = []
  canvas.forEachObject((object) => {
    if (!object.filters || !object.filters.length) {
      return
    }
    backup.push({ object, filters: object.filters })
    object.filters = []
    object.applyFilters()
  })
  return () => {
    backup.forEach(({ object, filters }) => {
      object.filters = filters
      object.applyFilters()
    })
  }
}

/** 马赛克色块大小的取值范围（像素） */
export const MOSAIC_BLOCK_RANGE = { min: 4, max: 64 }

/**
 * 区域里切几块（按"块边长尽量接近 size"取整数块）
 *
 * 块数必须是整数，但**色块整体尺寸恒等于框选区域**：
 * 用 ceil 会让色块比框选区多出最多一整块，于是拖动"色块"滑杆时框子会跟着变大变小，
 * 而且每次重画还会把多出来的部分累加进去，越调越离谱。
 * 这里改成按四舍五入取块数，每块的真实边长 = 区域 / 块数（与设定值只差一点点）。
 */
function blockCount(length, size) {
  return Math.max(1, Math.round(length / size))
}

/**
 * 局部马赛克（打码）
 *
 * 做法：把这块区域切成 block×block 的小格，每格取**格内所有像素的平均色**填成整格，
 * 内容就看不清了。生成的色块图作为一个普通图片元素贴在原地，
 * 因此它天然支持删除、撤销、以及协作同步（跟别的元素走同一套 add / remove 操作）。
 *
 * 取的是**当前画布的渲染结果**作为源，所以旋转、滤镜之后的画面也能正确打码。
 *
 * 注意不能直接用 drawImage 把区域缩小再放大回来：
 * 浏览器缩放大图时做的是稀疏采样而不是块平均，出来的色块颜色会偏，边界也对不齐。
 *
 * @param {fabric.Canvas} canvas
 * @param {{left:number,top:number,width:number,height:number}} area 打码区域（场景坐标）
 * @param {number} [block] 色块边长，越大越糊
 * @returns {Promise<fabric.FabricImage|null>} 区域完全在画布外时返回 null
 */
export async function createMosaicPatch(canvas, area, block = 12) {
  const rect = clampAreaToBounds(normalizeArea(area), canvasBounds(canvas))
  const source = canvas?.getElement()
  if (!rect || !source) {
    return null
  }
  const size = Math.min(MOSAIC_BLOCK_RANGE.max, Math.max(MOSAIC_BLOCK_RANGE.min, Math.round(block)))
  const cols = blockCount(rect.width, size)
  const rows = blockCount(rect.height, size)
  const retina = canvas.getRetinaScaling() || 1
  // 采到的必须是**未经滤镜处理的原始像素**：
  // 色块之后会像底图一样套上同一组滤镜，若这里直接采"已经调过色"的画面，
  // 后面再切灰度 / 调亮度就会叠上第二层，和底图越差越远
  const restoreFilters = clearFiltersForSampling(canvas)
  // 打码前刚删掉选框，而 fabric 的 requestRenderAll 是异步的：
  // 不强制同步重绘的话读到的还是带半透明选框的旧画面，色块会混进选框的颜色
  canvas.renderAll()
  // 采样范围就是框选区域本身：色块最终尺寸必须和它完全一致，
  // 否则"改颗粒"时框子会跟着块数变来变去
  const srcX = Math.max(0, Math.round(rect.left * retina))
  const srcY = Math.max(0, Math.round(rect.top * retina))
  const srcWidth = Math.max(1, Math.round(rect.width * retina))
  const srcHeight = Math.max(1, Math.round(rect.height * retina))
  const pixels = source.getContext('2d').getImageData(srcX, srcY, srcWidth, srcHeight).data
  restoreFilters()

  const small = document.createElement('canvas')
  small.width = cols
  small.height = rows
  const smallCtx = small.getContext('2d')
  const out = smallCtx.createImageData(cols, rows)
  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * srcHeight) / rows)
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * srcHeight) / rows))
    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor((col * srcWidth) / cols)
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * srcWidth) / cols))
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const index = (y * srcWidth + x) * 4
          r += pixels[index]
          g += pixels[index + 1]
          b += pixels[index + 2]
          count += 1
        }
      }
      const target = (row * cols + col) * 4
      out.data[target] = count ? r / count : 0
      out.data[target + 1] = count ? g / count : 0
      out.data[target + 2] = count ? b / count : 0
      out.data[target + 3] = 255
    }
  }
  smallCtx.putImageData(out, 0, 0)

  const image = await fabric.FabricImage.fromURL(small.toDataURL('image/png'), {
    crossOrigin: 'anonymous'
  })
  image.set({
    left: rect.left,
    top: rect.top,
    // 缩放比 = 区域 / 块数：色块铺出来正好是框选区域那么大，不随颗粒值变化
    scaleX: rect.width / cols,
    scaleY: rect.height / rows,
    // 关键：放大回来时不做平滑插值，否则色块会被糊成一片，看不出是马赛克
    imageSmoothing: false
  })
  // 打完就定型：色块只能"点选后删除 / 重调颗粒"，不允许拖走或拉变形
  // （拖走会露出被挡住的内容，拉伸会让颗粒变成非正方形，两者都没有意义）
  image.mosaic = true
  lockMosaicPatch(image)
  // 采的是原始像素，这里按底图当前的画面参数补上同一组滤镜，色块才不会"调色后掉队"
  const base = findObject(canvas, BASE_IMAGE_ID)
  const filters = buildFilters(base?.filterState || DEFAULT_FILTER_STATE)
  if (filters.length) {
    image.filters = filters
    image.applyFilters()
  }
  image.setCoords()
  return image
}

/**
 * 马赛克色块的锁定属性
 *
 * 和底图不同：色块必须保持可点选（选中才能删除 / 改颗粒），
 * 但移动、缩放、旋转全部锁死，也不显示控制点。
 */
const MOSAIC_LOCKED_PROPS = {
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  lockSkewingX: true,
  lockSkewingY: true,
  hoverCursor: 'pointer'
}

export function lockMosaicPatch(object) {
  if (!object) return object
  object.set(MOSAIC_LOCKED_PROPS)
  return object
}

/** 判断一个元素是不是马赛克色块 */
export function isMosaicPatch(object) {
  return Boolean(object?.mosaic)
}

/**
 * 画布尺寸跟随底图：整图旋转 / 缩放后把画布改成底图的实际大小
 *
 * 画布不跟着变的话，放大的部分会被画布边界切掉，画面直接丢失。
 *
 * @param {fabric.Canvas} canvas
 * @param {fabric.FabricImage} base 底图
 * @param {Object} [beforeBase] 底图改动**之前**的快照；撤销要回到改动前的样子，
 *                              必须在调用方改底图之前就取好
 * @returns {{ payload: Object, previous: Object, width: number, height: number }}
 */
export function fitCanvasToBase(canvas, base, beforeBase) {
  const oldWidth = canvas.getWidth()
  const oldHeight = canvas.getHeight()
  const previous = {
    width: oldWidth,
    height: oldHeight,
    elements: elementPositions(canvas),
    base: beforeBase || baseSnapshot(base)
  }
  base.setCoords()
  const box = base.getBoundingRect()
  const width = Math.max(1, Math.round(box.width))
  const height = Math.max(1, Math.round(box.height))
  const dx = -Math.round(box.left)
  const dy = -Math.round(box.top)
  canvas.forEachObject((object) => {
    object.set({ left: (object.left || 0) + dx, top: (object.top || 0) + dy })
    object.setCoords()
  })
  canvas.setDimensions({ width, height })
  canvas.requestRenderAll()
  return {
    width,
    height,
    previous,
    // 元素位置一律带绝对值：回包会再应用一次，用位移量会导致元素越飘越偏
    payload: { width, height, elements: elementPositions(canvas), base: baseSnapshot(base) }
  }
}

/**
 * 从序列化数据还原单个 fabric 对象
 */
export async function enlivenOne(snapshot) {
  try {
    const objects = await fabric.util.enlivenObjects([snapshot])
    return objects && objects.length ? objects[0] : null
  } catch (e) {
    return null
  }
}

/**
 * 底图锁定属性
 *
 * 底图是"画布背景"，不是可编辑元素：它铺满整个画布，一旦允许鼠标拖动 / 缩放，
 * 用户随手一拖就会把原图挪出画布，画在上面的文字线条也全部错位。
 * 整图的旋转与缩放只走工具栏按钮（程序化修改，不经过鼠标），因此这里全部锁死。
 */
const BASE_LOCKED_PROPS = {
  selectable: false,
  evented: false,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  hoverCursor: 'default'
}

/** 把底图锁死为不可交互元素（新建与远端还原后都要调用一次） */
export function lockBaseObject(object) {
  if (!object) {
    return object
  }
  object.set(BASE_LOCKED_PROPS)
  object.setCoords()
  return object
}

/**
 * 加载底图
 *
 * @param {fabric.Canvas} canvas
 * @param {string}       url 推荐使用同源 Blob URL：跨域图片会污染画布，导致导出时被浏览器拒绝
 * @param {Object}       [options]
 * @returns {Promise<fabric.FabricImage>}
 */
export async function loadBaseImage(canvas, url, options = {}) {
  const image = await fabric.FabricImage.fromURL(url, {
    crossOrigin: 'anonymous'
  })
  image.customId = BASE_IMAGE_ID
  if (!options.keepRatio) {
    image.scaleX = 1
    image.scaleY = 1
  }
  image.set({
    left: options.left ?? 0,
    top: options.top ?? 0
  })
  lockBaseObject(image)
  return image
}

/**
 * 导出画布为 Blob
 *
 * @param {fabric.Canvas} canvas
 * @param {Object} [options] { format, quality, multiplier }
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
/**
 * 把一张 w×h 的图完整放进可视区所需的显示比例
 *
 * 小图不放大：最多 1:1，否则一张 300×200 的图会被撑成满屏，看着像被拉伸过。
 *
 * @param {number} width  图片（画布）逻辑宽
 * @param {number} height 图片（画布）逻辑高
 * @param {number} availWidth  可视区可用宽
 * @param {number} availHeight 可视区可用高
 * @returns {number} 显示比例
 */
export function fitScaleFor(width, height, availWidth, availHeight) {
  if (!width || !height || !availWidth || !availHeight) {
    return 1
  }
  return Math.min(1, Math.min(availWidth / width, availHeight / height))
}

/**
 * 计算画布的显示比例（CSS 呈现尺寸 / 画布逻辑尺寸）
 *
 * 两种模式，对应专业编辑器里两组不同的概念：
 * <ul>
 *   <li><b>real（跟随真实尺寸）</b>：比例恒等于「原图放进可视区」的比例。
 *       图片的像素尺寸变大时，画布逻辑尺寸跟着变大，而比例不变 ——
 *       于是屏幕上的画面真的会变大，超出可视区的部分靠滚动查看。
 *       这是"放大要看得出来"的关键：不能每放大一次就把画面缩回窗口里，
 *       否则用户看到的永远是一样大的图，等于没有反馈。</li>
 *   <li><b>fit（适应窗口）</b>：按当前尺寸缩到完整可见（小图仍不放大，最多 1:1）。
 *       放大后想看全貌时用，属于纯视图操作，不改图片本身。</li>
 * </ul>
 *
 * @param {Object} options
 * @param {number} options.logicWidth   当前画布逻辑宽
 * @param {number} options.logicHeight  当前画布逻辑高
 * @param {number} options.originWidth  基准尺寸宽（原图 / 裁剪所得），real 模式用它算比例
 * @param {number} options.originHeight 基准尺寸高
 * @param {number} options.availWidth   可视区可用宽
 * @param {number} options.availHeight  可视区可用高
 * @param {'real'|'fit'} [options.mode] 显示模式
 * @param {number} [options.minDisplaySide] 屏幕长边的最小像素数（兜底，避免缩到看不见）
 * @returns {number} 显示比例
 */
export function computeDisplayScale(options) {
  const {
    logicWidth,
    logicHeight,
    originWidth,
    originHeight,
    availWidth,
    availHeight,
    mode = 'real',
    minDisplaySide = 32
  } = options
  if (!availWidth || !availHeight) {
    return 1
  }
  const fitNow = fitScaleFor(logicWidth, logicHeight, availWidth, availHeight)
  const scale =
    mode === 'fit' || !originWidth || !originHeight
      ? fitNow
      : fitScaleFor(originWidth, originHeight, availWidth, availHeight)
  // 兜底：任何模式下都别把画面缩到只剩几个像素
  const floor = Math.min(1, minDisplaySide / Math.max(logicWidth || 1, logicHeight || 1))
  return Math.max(scale, floor)
}

/** 浏览器 canvas 的硬限制：单边约 16384px，总面积约 268MP，超过就画不出来（导出会变空白） */
const MAX_EXPORT_SIDE = 16384
const MAX_EXPORT_PIXELS = 268435456

export async function exportCanvasBlob(canvas, options = {}) {
  const { format = 'png', quality = 0.92 } = options
  const logicWidth = canvas.getWidth()
  const logicHeight = canvas.getHeight()
  // 反复放大 / 扩展画布可能把尺寸撑到浏览器画不出来的地步，这里等比收进安全范围
  let multiplier = Math.min(1, MAX_EXPORT_SIDE / Math.max(logicWidth, logicHeight))
  const pixels = logicWidth * logicHeight
  if (pixels > MAX_EXPORT_PIXELS) {
    multiplier = Math.min(multiplier, Math.sqrt(MAX_EXPORT_PIXELS / pixels))
  }
  // 编辑器会把画布按窗口缩放显示（viewport 缩放），导出必须回到 1:1 的原图尺寸，
  // 否则导出的图会跟着显示比例一起变小。用完立刻还原，不影响界面。
  const viewport = canvas.viewportTransform ? [...canvas.viewportTransform] : null
  if (viewport) {
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  }
  let dataUrl
  try {
    dataUrl = canvas.toDataURL({ format, quality, multiplier })
  } finally {
    if (viewport) {
      canvas.setViewportTransform(viewport)
    }
  }
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return {
    blob,
    width: Math.max(1, Math.round(logicWidth * multiplier)),
    height: Math.max(1, Math.round(logicHeight * multiplier))
  }
}

/**
 * 计算一英寸像素占比，用于把屏幕上的字号换算为导出尺寸下的字号（这里保持 1:1，交由调用方决定）
 */
export function currentViewport(canvas) {
  return canvas.viewportTransform ? [...canvas.viewportTransform] : [1, 0, 0, 1, 0, 0]
}
