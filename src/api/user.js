import request from './request'

/**
 * 用户接口（对应 UserController，/user）
 */

/** 用户注册 */
export function register(data) {
  return request.post('/user/register', data)
}

/** 用户登录，返回 token 字符串 */
export function login(data) {
  return request.post('/user/login', data)
}

/** 退出登录 */
export function logout() {
  return request.post('/user/logout')
}

/** 获取当前登录用户 */
export function getLoginUser() {
  return request.get('/user/getLoginUser')
}

/** 新增用户（管理员） */
export function addUser(data) {
  return request.post('/user/add', data)
}

/** 分页查询用户列表（管理员） */
export function queryUserList(data) {
  return request.post('/user/queryList', data)
}

/** 根据 id 查询用户详情 */
export function getUserById(userId) {
  return request.get('/user/getById', { params: { userId } })
}

/**
 * 关键词搜索用户（团队空间邀请成员时检索被邀请人）
 *
 * 与 queryUserList 的区别：queryUserList 是管理员后台的分页列表，需要管理员权限；
 * 本接口只要登录即可调用，团队空间管理员（普通用户）也能搜到被邀请人。
 * 关键词同时匹配账号与昵称；不含当前登录用户自己；最多返回 20 条。
 *
 * @param {string} keyword 账号 / 昵称关键词
 * @returns {Promise<Array<{id: string, userAccount: string, userName: string, userAvatar: string}>>}
 */
export function searchUsers(keyword) {
  return request.get('/user/search', { params: { keyword } })
}

/** 更新用户（管理员，/user/update 带 @AuthCheck） */
export function updateUser(data) {
  return request.post('/user/update', data)
}

/**
 * 修改「当前登录用户」自己的资料
 *
 * 后端 UpdateMyInfoRequest 只接受 userName / userAvatar / userProfile，
 * 目标用户由服务端从登录态确定，请求体无法指定 id，天然只能改自己。
 * 注意：userAvatar 必须是当前用户 temp 目录下的相对路径（temp/image/{userId}/...），
 * 否则后端会报「头像地址非法」；传 null 表示不更新，userProfile 传空串表示清空。
 */
export function updateMyInfo(data) {
  return request.post('/user/updateMyInfo', data)
}

/**
 * 修改当前登录用户的密码
 * 后端会踢掉该用户的其他登录态，当前设备保持在线。
 */
export function updatePassword(data) {
  return request.post('/user/updatePassword', data)
}

/** 删除用户（管理员） */
export function deleteUser(id) {
  return request.post('/user/delete', { id })
}
