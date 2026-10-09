import request from './request'

/**
 * 空间成员接口（对应 SpaceUserController，/spaceUser）
 *
 * 后端规则（SpaceUserServiceImpl）：
 * 1. 成员管理是团队空间专属能力，个人空间调用会报「个人空间不支持邀请成员」；
 * 2. 只有空间 admin（创建者）或平台管理员能邀请 / 移除成员；
 * 3. admin 只能随空间创建产生：不能邀请管理员，创建者也不能被移除（只能删空间）；
 * 4. 邀请不需要被邀请人同意，直接生效；已移除的成员重新邀请会新建一条关联记录；
 * 5. 成员角色可改（/spaceUser/update），但只能在 viewer / editor 之间互改；
 * 6. 成员列表（/spaceUser/queryList）要求对该空间有 picture:view 权限，成员可看，非成员被拒。
 */

/**
 * 邀请成员加入空间
 * @param {object} data SpaceUserAddRequest：{ spaceId, userId, spaceRole }，spaceRole 仅 viewer / editor
 */
export function addSpaceUser(data) {
  return request.post('/spaceUser/add', data)
}

/**
 * 移除空间成员
 * @param {object} data SpaceUserRemoveRequest：{ spaceId, userId }
 */
export function removeSpaceUser(data) {
  return request.post('/spaceUser/delete', data)
}

/**
 * 修改空间成员角色
 *
 * 后端限制：仅空间 admin（或平台管理员）可改；目标角色只能是 viewer / editor
 * （admin 只随空间创建产生，不能通过修改得到）；空间创建者的角色不可修改。
 *
 * @param {object} data SpaceUserUpdateRequest：{ spaceId, userId, spaceRole }
 */
export function updateSpaceUser(data) {
  return request.post('/spaceUser/update', data)
}

/**
 * 查询空间成员列表（不分页）
 * @param {object} data SpaceUserQueryRequest：{ spaceId }
 * @param {object} [config] axios 额外配置
 */
export function querySpaceUserList(data, config) {
  return request.post('/spaceUser/queryList', data, config)
}
