import request from './request'

/**
 * 分类接口（对应 CategoryController，/category）
 */

/** 查询分类列表（普通用户，返回 CategoryVO：id + categoryName） */
export function queryCategoryList() {
  return request.get('/category/queryList')
}

/** 查询分类列表（管理员，返回 Category 实体，含创建/编辑时间） */
export function queryAdminCategoryList() {
  return request.get('/category/admin/queryList')
}

/** 新增分类（管理员） */
export function addCategory(data) {
  return request.post('/category/admin/add', data)
}

/** 更新分类名称（管理员） */
export function updateCategory(data) {
  return request.post('/category/admin/update', data)
}

/** 删除分类（管理员）；后端会校验是否仍有图片引用 */
export function deleteCategory(id) {
  return request.post('/category/admin/delete', { id })
}

/** 批量更新分类排序（管理员）；items 为 [{ id, sort }]，sort 越小越靠前 */
export function updateCategorySort(items) {
  return request.post('/category/admin/updateSort', { items })
}
