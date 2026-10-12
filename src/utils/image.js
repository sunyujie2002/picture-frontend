/**
 * 图片地址解析
 *
 * 后端 picture 表的 url / thumbnailUrl 存的是 COS 的 object key（相对路径），
 * 形如 public/image/123/xxx.webp、private/image/123/xxx.webp、temp/image/123/xxx.webp，
 * 前端展示时需要统一拼接对象存储访问域名。
 * 域名通过 VITE_COS_BASE_URL 配置，见 .env.development / .env.production。
 */

/** 对象存储访问域名（去掉结尾多余的斜杠） */
export const COS_BASE_URL = (import.meta.env.VITE_COS_BASE_URL || '').replace(/\/+$/, '')

const ABSOLUTE_PATTERN = /^(https?:)?\/\//i
const INLINE_PATTERN = /^(data|blob):/i

/**
 * 把后端返回的相对路径解析为可访问的图片地址
 * @param {string} url 相对路径或完整地址
 * @returns {string} 可直接用于 img src 的地址，空值返回空串
 */
export function resolveImageUrl(url) {
  if (!url) return ''
  const value = String(url).trim()
  if (!value) return ''

  // 已经是完整地址、协议相对地址或内联数据，原样返回
  if (ABSOLUTE_PATTERN.test(value) || INLINE_PATTERN.test(value)) {
    return value.startsWith('//') ? `https:${value}` : value
  }

  if (!COS_BASE_URL) return value

  // 去掉 key 开头的 /，避免拼出双斜杠
  return `${COS_BASE_URL}/${value.replace(/^\/+/, '')}`
}

/**
 * 图片展示地址：优先缩略图，无缩略图回退原图
 * 后端约定 thumbnailUrl 为空即表示无需缩略图
 */
export function displayUrl(picture) {
  return resolveImageUrl(picture?.thumbnailUrl || picture?.url)
}

/**
 * 原图地址（COS 直链）
 * 注意：这是公开可访问的地址，拿到的人不需要登录就能保存图片，
 * 所以不要用于「复制链接」这类会把它交给用户的场景，
 * 下载一律走后端 /picture/download 接口（会校验登录态）
 */
export function originUrl(picture) {
  return resolveImageUrl(picture?.url)
}
