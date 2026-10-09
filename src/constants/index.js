/** 图片审核状态（PictureReviewEnum） */
export const REVIEW_STATUS = {
  PENDING: 0,
  PASS: 1,
  REJECT: 2
}

export const REVIEW_STATUS_OPTIONS = [
  { value: 0, label: '待审核', color: 'gold' },
  { value: 1, label: '审核通过', color: 'green' },
  { value: 2, label: '审核拒绝', color: 'red' }
]

export const REVIEW_STATUS_MAP = REVIEW_STATUS_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

/**
 * 空间级别（SpaceLevelEnum）
 * size 与后端枚举保持一致（单位：字节），用于容量展示与升级对比。
 * 后端容量已上调为 GB 量级：普通版 5GB / 专业版 20GB / 旗舰版 50GB，
 * 即 size = N * 1024 * 1024 * 1024。后端补齐空间查询接口后，容量以服务端 maxSize 为准。
 */
export const SPACE_LEVEL_OPTIONS = [
  { value: 0, label: '普通版', color: 'default', size: 5 * 1024 * 1024 * 1024 },
  { value: 1, label: '专业版', color: 'blue', size: 20 * 1024 * 1024 * 1024 },
  { value: 2, label: '旗舰版', color: 'purple', size: 50 * 1024 * 1024 * 1024 }
]

export const SPACE_LEVEL_MAP = SPACE_LEVEL_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

/** 等级 → 容量（字节） */
export const SPACE_LEVEL_CAPACITY = SPACE_LEVEL_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.size
  return acc
}, {})

/** 可付费升级到的版本（排除普通版自身） */
export const SPACE_UPGRADE_OPTIONS = SPACE_LEVEL_OPTIONS.filter((item) => item.value !== 0)

/**
 * 空间类型（SpaceTypeEnum）
 * 后端约束：同一用户每种类型仅能创建一个空间，即「1 个个人空间 + 1 个团队空间」。
 */
export const SPACE_TYPE = {
  PERSONAL: 0,
  TEAM: 1
}

export const SPACE_TYPE_OPTIONS = [
  { value: SPACE_TYPE.PERSONAL, label: '个人空间', color: 'default' },
  { value: SPACE_TYPE.TEAM, label: '团队空间', color: 'blue' }
]

export const SPACE_TYPE_MAP = SPACE_TYPE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

/**
 * 团队空间角色（SpaceRoleEnum）
 * 权限由角色推导，后端不存权限码：
 * viewer 只读；editor 可查看 / 上传 / 修改；admin 全部权限（含成员管理）。
 */
export const SPACE_ROLE = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin'
}

export const SPACE_ROLE_OPTIONS = [
  { value: SPACE_ROLE.VIEWER, label: '浏览者', color: 'default', desc: '只能查看空间图片' },
  { value: SPACE_ROLE.EDITOR, label: '编辑者', color: 'blue', desc: '可查看、上传、修改图片' },
  { value: SPACE_ROLE.ADMIN, label: '管理员', color: 'purple', desc: '全部权限，可邀请与移除成员' }
]

export const SPACE_ROLE_MAP = SPACE_ROLE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

/**
 * 邀请成员时可选的角色
 * 后端限制：admin 只能随空间创建产生，不能邀请、不能被移除，所以这里只有 viewer / editor。
 */
export const SPACE_INVITE_ROLE_OPTIONS = SPACE_ROLE_OPTIONS.filter(
  (item) => item.value !== SPACE_ROLE.ADMIN
)

/**
 * 角色 → 权限码（SpacePermissionEnum，后端 SpaceRoleEnum 的同名映射）
 * 前端只用于「按钮该不该显示」的预判，真正的拦截在后端。
 */
export const SPACE_ROLE_PERMISSIONS = {
  [SPACE_ROLE.VIEWER]: ['picture:view'],
  [SPACE_ROLE.EDITOR]: ['picture:view', 'picture:add', 'picture:update'],
  [SPACE_ROLE.ADMIN]: ['picture:view', 'picture:add', 'picture:update', 'picture:delete']
}

export const USER_ROLE = {
  USER: 'user',
  ADMIN: 'admin'
}
/** 用户角色（UserRoleEnum） */
export const USER_ROLE_OPTIONS = [
  { value: USER_ROLE.USER, label: '用户', color: 'default' },
  { value: USER_ROLE.ADMIN, label: '管理员', color: 'red' }
]

export const USER_ROLE_MAP = USER_ROLE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

/** 图片范围（PictureController 的 {scope} 路径参数） */
export const PICTURE_SCOPE = {
  PUBLIC: 'public',
  PRIVATE: 'private'
}

/** 常用图片格式筛选项 */
export const PIC_FORMAT_OPTIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].map((v) => ({
  value: v,
  label: v.toUpperCase()
}))

/** 排序字段与方式（PageRequest.sortField / sortOrder） */
export const SORT_FIELD_OPTIONS = [
  { value: 'createTime', label: '创建时间' },
  { value: 'editTime', label: '编辑时间' },
  { value: 'picSize', label: '图片体积' },
  { value: 'picName', label: '图片名称' }
]

export const SORT_ORDER = {
  DESC: 'descend',
  ASC: 'ascend'
}

/** 分页默认值 */
export const DEFAULT_PAGE = { pageNum: 1, pageSize: 20 }
export const PAGE_SIZE_OPTIONS = ['12', '20', '40', '80']
