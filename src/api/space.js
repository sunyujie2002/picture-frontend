import request from './request'

/**
 * 空间接口（对应 SpaceController，/space）
 *
 * 后端空间规则（SpaceController / SpaceServiceImpl）：
 * 1. 空间分两类：个人空间（spaceType = 0）、团队空间（spaceType = 1）；
 *    同一用户每种类型仅能创建一个，重复创建后端报「每个用户仅能创建一个XX空间」。
 * 2. GET  /space/queryById：
 *    - 不传 id：按 spaceType 定位「当前登录用户」自己的空间（不传类型默认个人空间），
 *      没创建返回 null（正常初始状态，不报错），前端据此引导创建；
 *    - 传 id：走 checkSpaceAuth，只认空间创建者与平台管理员，被邀请的成员查不了。
 * 3. POST /space/create：团队空间会在同一事务里写入创建者的 admin 成员记录；
 *    成员邀请 / 移除 / 列表走 /spaceUser（见 api/spaceUser.js）。
 * 4. POST /space/queryList：管理员视角的全量空间列表，前端在路由层用 admin 门控。
 * 5. POST /space/queryMylist：查询「我的团队空间」列表（我创建的 + 我被邀请加入的），
 *    后端按当前登录用户查询，无需入参；返回的每项 SpaceVO 带 spaceRole（我在该空间的角色）。
 */

/** 查询空间列表（管理员视角：全部空间，支持 spaceType / spaceLevel / spaceName 筛选与分页） */
export function querySpaceList(data) {
  return request.post('/space/queryList', data)
}

/**
 * 查询单个空间
 *
 * @param {string|number} [id] 空间 id；不传则按 spaceType 定位当前登录用户自己的空间
 * @param {number} [spaceType] 空间类型（0-个人 1-团队）；仅在 id 为空时生效，不传默认个人空间
 * @param {object} [config] axios 额外配置，如 { silent: true }：探测场景不弹全局错误提示
 */
export function querySpaceById(id, spaceType, config) {
  const params = {}
  if (id) params.id = id
  if (spaceType !== undefined && spaceType !== null && spaceType !== '') params.spaceType = spaceType
  return request.get('/space/queryById', { params, ...config })
}

/**
 * 创建空间
 * @param {object} data SaveSpaceRequest：{ spaceName, spaceType }，新增时不能带 spaceId
 */
export function createSpace(data) {
  return request.post('/space/create', data)
}

/** 更新空间（spaceId 必填） */
export function updateSpace(data) {
  return request.post('/space/update', data)
}

/** 删除空间 */
export function deleteSpace(id) {
  return request.post('/space/delete', { id })
}

/**
 * 查询「我的团队空间」列表：我创建的团队空间 + 我被邀请加入的团队空间
 *
 * 后端按登录态定位用户，无需入参，不返回个人空间（个人空间走 querySpaceById）。
 * 每项额外回填 spaceRole（admin = 我创建的，viewer / editor = 被邀请加入的）。
 *
 * @param {object} [config] axios 额外配置，如 { silent: true }：探测场景不弹全局错误提示
 * @returns {Promise<Array<object>>} SpaceVO 列表，未加入任何团队空间时为空数组
 */
export function queryMySpaceList(config) {
  return request.post('/space/queryMylist', undefined, config)
}
