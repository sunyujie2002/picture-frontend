import dayjs from 'dayjs'
import {
  NOT_LOGIN_MESSAGE,
  REVIEW_STATUS_MAP,
  SPACE_LEVEL_MAP,
  SPACE_ROLE_MAP,
  SPACE_TYPE_MAP,
  USER_ROLE_MAP
} from '@/constants'
import { getToken } from '@/api/request'

/** ErrorCode.NOT_LOGIN_ERROR，与后端一致 */
const NOT_LOGIN_CODE = 40100

/**
 * 格式化文件体积
 * @param {number|string} bytes 字节数
 * @param {number} digits 小数位，默认 2；容量类数值可传 3 提升精度
 */
export function formatSize(bytes, digits = 2) {
  if (bytes === null || bytes === undefined || bytes === '') return '-'
  const size = Number(bytes)
  if (Number.isNaN(size) || size < 0) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(digits)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(digits)} GB`
}

/** 格式化时间，空值返回占位符 */
export function formatTime(time, placeholder = '-') {
  if (!time) return placeholder
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : placeholder
}

/**
 * 归一化主色调：后端可能返回 0xRRGGBB / #RRGGBB / RRGGBB
 * @returns {string} #RRGGBB，无法解析时返回空串
 */
export function normalizeColor(color) {
  if (!color) return ''
  let hex = String(color).trim()
  if (hex.startsWith('0x') || hex.startsWith('0X')) hex = `#${hex.slice(2)}`
  if (!hex.startsWith('#')) hex = `#${hex}`
  // 仅接受 #RGB / #RRGGBB
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    }
    return hex.toLowerCase()
  }
  return ''
}

/** 宽高比保留两位小数 */
export function formatScale(scale) {
  if (!scale) return '-'
  const val = Number(scale)
  return Number.isNaN(val) ? '-' : val.toFixed(2)
}

/** 审核状态元信息 */
export function reviewMeta(status) {
  return REVIEW_STATUS_MAP[status] || { label: '未知', color: 'default' }
}

/** 空间级别元信息 */
export function spaceLevelMeta(level) {
  return SPACE_LEVEL_MAP[level] || { label: '未知', color: 'default' }
}

/** 用户角色元信息 */
export function userRoleMeta(role) {
  return USER_ROLE_MAP[role] || { label: role || '未知', color: 'default' }
}

/** 空间类型元信息（个人空间 / 团队空间） */
export function spaceTypeMeta(type) {
  return SPACE_TYPE_MAP[type] || { label: '未知', color: 'default' }
}

/** 团队空间角色元信息（viewer / editor / admin） */
export function spaceRoleMeta(role) {
  return SPACE_ROLE_MAP[role] || { label: role || '未知', color: 'default', desc: '' }
}

/**
 * 下载图片（统一走后端接口 GET /picture/download?id={id}），支持流式进度回调
 *
 * 后端按 id 鉴权后把 COS 文件以 application/octet-stream 流式返回，
 * 并在响应头 Content-Disposition: attachment; filename*=UTF-8''<编码文件名>
 * 中声明真实文件名（数据库 picName + 实际格式），同时设置 Content-Length（picSize），
 * 前端可据此计算真实下载百分比。
 *
 * 鉴权依赖 Authorization 请求头（token 存于 localStorage，不会随浏览器普通跳转携带），
 * 因此必须用 fetch 显式带上 Authorization，不能仅靠 <a href> / window.location 跳转。
 *
 * 为了实现「点击后立刻看到进度」，不等整个文件传完：优先用 response.body 分块读取，
 * 每收到一个分块回调一次 onProgress；老浏览器没有 body 流时降级为整体 blob
 * （进度只在完成时跳 100%，功能不受影响）。
 *
 * @param {object} picture 图片对象，至少包含 id（字符串，勿转 Number）
 * @param {object} [options]
 * @param {(p: {loaded: number, total: number}) => void} [options.onProgress] 进度回调（单位字节）
 * @param {AbortSignal} [options.signal] 取消信号（AbortController）
 * @returns {Promise<void>} 成功 resolve；失败 reject（错误信息优先取自后端响应）
 */
export async function downloadPicture(picture, options = {}) {
  const { onProgress, signal } = options
  const id = picture?.id
  if (id === null || id === undefined || id === '') {
    throw new Error('图片ID缺失，无法下载')
  }

  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  const url = `${base}/picture/download?id=${encodeURIComponent(id)}`

  let resp
  try {
    resp = await fetch(url, { method: 'GET', headers: { Authorization: getToken() }, signal })
  } catch (e) {
    // 用户主动取消：原样抛出，由调用方静默移除任务，不当成错误提示
    if (e?.name === 'AbortError') throw e
    throw new Error('网络异常，下载失败，请稍后重试')
  }

  // 后端异常（未登录 / 无权限 / 未过审 / 图片不存在 / 参数错误）时返回的是
  // 「HTTP 200 + JSON 错误体」——LoginInterceptor 抛的异常由全局异常处理器写成 JSON，
  // 状态码仍是 200，所以不能只看 resp.ok，否则会把错误体当成文件内容下载下来。
  // 成功下载时后端返回的是 application/octet-stream，据此区分。
  const contentType = (resp.headers.get('content-type') || '').toLowerCase()
  if (!resp.ok || contentType.includes('application/json')) {
    let code = null
    let reason = resp.ok ? '下载失败' : `下载失败（${resp.status}）`
    try {
      const errBody = await resp.json()
      code = errBody?.code
      if (errBody?.message) reason = errBody.message
    } catch (_) {
      /* 非 JSON 错误体，沿用默认提示 */
    }
    if (code === NOT_LOGIN_CODE) {
      // 与路由拦截、接口 40100 保持同一句提示，并触发统一的登录跳转
      window.dispatchEvent(new CustomEvent('app:unauthorized'))
      throw new Error(NOT_LOGIN_MESSAGE)
    }
    throw new Error(reason)
  }

  // 优先用后端声明的文件名；缺失时回退到前端记录的字段
  const filename =
    parseDispositionFilename(resp.headers.get('content-disposition')) ||
    buildFallbackName(picture)
  // 后端已设置 Content-Length；缺失（极少数情况）时 total 为 0，
  // 进度退化为「已接收字节数」+ 滚动动画，不影响下载本身
  const total = Number(resp.headers.get('content-length')) || 0

  // 流式读取：每收到一个分块就回调一次进度，页面进度条随之实时更新
  let blob
  if (resp.body && typeof resp.body.getReader === 'function') {
    const reader = resp.body.getReader()
    const chunks = []
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && value.length > 0) {
        chunks.push(value)
        loaded += value.length
        onProgress?.({ loaded, total })
      }
    }
    blob = new Blob(chunks)
  } else {
    // 老浏览器降级：整体读取，完成时一次性回调
    blob = await resp.blob()
    onProgress?.({ loaded: blob.size, total: blob.size })
  }

  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500)
}

/**
 * 从 Content-Disposition 头解析出文件名。
 * 兼容 filename*=UTF-8''<编码> 与 filename="<名称>" 两种写法。
 */
function parseDispositionFilename(disposition) {
  if (!disposition) return ''
  const star = disposition.match(/filename\*\s*=\s*(?:[^']*'')([^;]+)/i)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch (_) {
      /* 解码失败，继续尝试普通 filename */
    }
  }
  const plain = disposition.match(/filename\s*=\s*("?)([^;"]+)\1/i)
  if (plain?.[2]) return plain[2].trim()
  return ''
}

/** 后端未声明文件名时的兜底命名：picName + 实际格式 */
function buildFallbackName(picture) {
  const name = picture?.picName || 'picture'
  const ext = picture?.picFormat ? String(picture.picFormat).toLowerCase() : ''
  return ext && !name.toLowerCase().endsWith('.' + ext) ? `${name}.${ext}` : name
}

/** 复制到剪贴板 */
export async function copyText(text) {
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {
    /* 降级处理 */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  return ok
}
