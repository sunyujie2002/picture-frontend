import request from './request'

/**
 * 标签接口（对应 TagController，/tag）
 */

/** 查询标签列表（普通用户，返回 TagVO：id + tagName） */
export function queryTagList() {
  return request.get('/tag/queryList')
}

/** 查询标签列表（管理员，返回 Tag 实体，含创建/编辑时间） */
export function queryAdminTagList() {
  return request.get('/tag/admin/queryList')
}

/** 新增标签（管理员） */
export function addTag(data) {
  return request.post('/tag/admin/add', data)
}

/** 更新标签名称（管理员） */
export function updateTag(data) {
  return request.post('/tag/admin/update', data)
}

/** 删除标签（管理员）；后端会同步清理图片-标签关联 */
export function deleteTag(id) {
  return request.post('/tag/admin/delete', { id })
}
