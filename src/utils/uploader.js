import { getUserById } from '@/api/user'

/**
 * 上传者名称缓存
 *
 * 图片接口只返回 userId，没有批量查用户名的接口；
 * 管理员视角的列表需要展示上传者，这里按 id 逐个查询并缓存，避免重复请求。
 */
const cache = new Map()
const pending = new Map()

/** 读取缓存中的用户名，未命中返回空串 */
export function cachedUserName(id) {
  if (id === null || id === undefined || id === '') return ''
  return cache.get(String(id)) || ''
}

/**
 * 批量补齐用户名（已缓存或已在请求中的 id 会跳过）
 * @param {Array<string|number>} ids 用户 id 列表
 */
export async function loadUserNames(ids) {
  const list = (ids || [])
    .filter((id) => id !== null && id !== undefined && id !== '')
    .map((id) => String(id))
  const tasks = []
  for (const id of new Set(list)) {
    if (cache.has(id) || pending.has(id)) continue
    const task = getUserById(id)
      .then((user) => {
        cache.set(id, user?.userName || user?.userAccount || '')
      })
      .catch(() => {
        // 无权限或用户已删除时留空，展示层回退成 #id
        cache.set(id, '')
      })
      .finally(() => pending.delete(id))
    pending.set(id, task)
    tasks.push(task)
  }
  await Promise.all(tasks)
}

/** 切换用户时清空缓存 */
export function clearUserNameCache() {
  cache.clear()
  pending.clear()
}
