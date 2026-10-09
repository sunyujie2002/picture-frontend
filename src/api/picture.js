import request from './request'

/**
 * 图片接口（对应 PictureController，/picture）
 */

/** 上传图片（本地文件），入参为 FormData，字段名为 file */
export function uploadPicture(formData, onProgress) {
  // 不显式声明 Content-Type：axios 对 FormData 会置空，由浏览器自动补 boundary
  return request.post('/picture/upload', formData, {
    timeout: 120000,
    onUploadProgress: onProgress
  })
}

/** 通过 URL 上传图片 */
export function uploadPictureByUrl(fileUrl) {
  return request.get('/picture/uploadByUrl', { params: { fileUrl } })
}

/** 批量抓取图片入库 */
export function uploadPictureByBatch(data) {
  return request.post('/picture/uploadByBatch', data)
}

/**
 * 新增图片
 * @param {'public'|'private'} scope 图片范围
 */
export function addPicture(scope, data) {
  return request.post(`/picture/${scope}/add`, data)
}

/** 更新图片 */
export function updatePicture(data) {
  return request.post('/picture/update', data)
}

/**
 * 批量修改图片（分类 / 标签）
 * 注意：后端路径为 /picture/batch/update（BatchUpdatePictureRequest）
 */
export function batchEditPicture(data) {
  return request.post('/picture/batch/update', data)
}

/** 批量删除图片 */
export function batchDeletePicture(pictureIds) {
  return request.post('/picture/batch/delete', { pictureIds })
}

/**
 * 四个列表接口的分工（后端 PictureServiceImpl 强约束，前端不要混用）：
 *
 * 1. queryHomePictureList —— 首页图库：只返回「审核通过 且 不属于任何空间」的图片。
 * 2. queryPublicPictureList —— 公共图片管理列表：space_id 为空、且由当前用户自己上传的图片。
 *    管理员也一样只看自己的，不返回他人图片（后端 applyScopeCondition 强制 user_id = 当前用户），
 *    因此「图片管理」页不需要区分管理员与普通用户。支持按审核状态筛选（仅筛选，不改状态）。
 * 3. queryPrivatePictureList —— 私有图库：只返回当前用户个人空间下的图片，
 *    用户未创建空间时后端直接抛「用户未创建空间」。
 * 4. queryReviewPictureList —— 管理员审核列表：公共图库中「非管理员用户」上传的图片，
 *    即管理员审核他人图片的专用数据源，支持按审核状态筛选。
 */

/** 分页查询公共图片管理列表（只返回自己上传的图片，入参 QueryPictureRequest） */
export function queryPublicPictureList(data) {
  return request.post('/picture/public/queryList', data)
}

/**
 * 分页查询管理员审核列表（他人上传的公共图片）
 * 后端会把管理员自己上传的图片排除掉，管理员内容视为已受信、无需审核。
 */
export function queryReviewPictureList(data) {
  return request.post('/picture/review/queryList', data)
}

/**
 * 分页查询私有图库（入参 QueryHomePictureRequest）
 * @param {object} data 查询参数
 * @param {object} [config] axios 额外配置，传 { silent: true } 可跳过全局错误提示
 */
export function queryPrivatePictureList(data, config) {
  return request.post('/picture/private/queryList', data, config)
}

/** 分页查询首页图库（入参 QueryHomePictureRequest） */
export function queryHomePictureList(data) {
  return request.post('/picture/home/queryList', data)
}

/** 删除图片 */
export function deletePicture(id) {
  return request.post('/picture/delete', { id })
}

/** 根据 id 查询图片详情（仅审核通过的图片可用，详情优先用列表返回字段回显） */
export function queryPictureById(id) {
  return request.get('/picture/queryById', { params: { id } })
}

/** 以图搜图：根据图片 id 查找相似图片（感知哈希），返回 HomePictureVO 列表 */
export function searchPictureByPicture(pictureId) {
  return request.post('/picture/search/picture', { pictureId })
}

/** 图片审核（管理员） */
export function reviewPicture(data) {
  return request.post('/picture/review', data)
}
