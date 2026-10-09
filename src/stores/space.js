import { defineStore } from 'pinia'
import { createSpace, queryMySpaceList, querySpaceById, updateSpace } from '@/api/space'
import { addSpaceUser, querySpaceUserList, removeSpaceUser, updateSpaceUser } from '@/api/spaceUser'
import { SPACE_LEVEL_CAPACITY, SPACE_ROLE, SPACE_ROLE_PERMISSIONS, SPACE_TYPE } from '@/constants'

/**
 * 空间状态（个人空间 + 团队空间列表）
 *
 * 后端约束（SpaceServiceImpl / SpaceUserServiceImpl）：
 * 1. 个人空间每人至多一个，走 GET /space/queryById（不带 id，按 spaceType 定位当前用户自己的空间）；
 *    没创建是正常状态，后端返回 null，前端据此引导创建。
 * 2. 团队空间用 POST /space/queryMylist 一次性返回「我创建的 + 我被邀请加入的」全部团队空间，
 *    所以团队侧是一个列表而不是单个槽位；每项带 spaceRole：
 *    admin = 我创建的（admin 只随空间创建产生，不能被邀请），viewer / editor = 被邀请加入的。
 * 3. 空间的已用容量（totalSize）、图片数（totalCount）、总容量（maxSize）一律以后端返回为准，
 *    前端不再拉取图片列表累加估算。
 * 4. 团队空间成员：创建空间时后端自动写入创建者的 admin 成员记录；
 *    邀请 / 修改角色 / 移除 / 列表走 /spaceUser，且只有空间 admin 能增删与改角色；
 *    admin 不能被邀请、不能被移除、角色也不能被改，可邀请 / 可改的角色只有 viewer / editor。
 *    改的是「我自己的角色」时要调 refreshMyRole() 重拉列表，同步当前空间里我的角色。
 * 5. 私有图片的增删查（/picture/private/*）必须带 spaceId，前端统一取当前空间的 id 带上。
 */

function storageKey(userId) {
  return `picture_space_${userId || 'anonymous'}`
}

/** 本地缓存里的空间必须有 id 才算数，否则视为未创建 */
function normalizeSpace(raw, spaceType) {
  if (!raw || !raw.id) return null
  return {
    id: String(raw.id),
    spaceName: raw.spaceName || '',
    spaceType: raw.spaceType ?? spaceType,
    spaceLevel: raw.spaceLevel ?? 0,
    maxSize: Number(raw.maxSize || SPACE_LEVEL_CAPACITY[raw.spaceLevel ?? 0] || 0),
    totalSize: Number(raw.totalSize || 0),
    totalCount: Number(raw.totalCount || 0),
    createTime: raw.createTime || '',
    // 我在该空间的角色（团队空间）；创建者用户名用于「谁的空间」展示
    spaceRole: raw.spaceRole || '',
    userId: raw.userId ? String(raw.userId) : '',
    userName: raw.userName || ''
  }
}

function normalizeList(list, spaceType) {
  return (Array.isArray(list) ? list : [])
    .map((item) => normalizeSpace(item, spaceType))
    .filter(Boolean)
}

export const useSpaceStore = defineStore('space', {
  state: () => ({
    /** 是否已完成一次服务端探测 */
    probed: false,
    loading: false,
    /** 个人空间详情；null = 未创建（或尚未探测） */
    personal: null,
    /** 我的团队空间列表（我创建的 + 我加入的），保持后端返回顺序（创建时间升序） */
    teams: [],
    /** 当前查看的空间类型（SPACE_TYPE） */
    currentType: SPACE_TYPE.PERSONAL,
    /** 当前查看的团队空间 id（仅 currentType 为团队时生效） */
    currentTeamId: '',
    /** 当前团队空间的成员列表（SpaceUserVO） */
    members: [],
    membersLoading: false
  }),

  getters: {
    /** 当前空间详情 */
    current(state) {
      if (state.currentType === SPACE_TYPE.TEAM) {
        return state.teams.find((item) => item.id === state.currentTeamId) || null
      }
      return state.personal
    },

    /** 当前团队空间（未选中团队类型时为 null；判断"有没有团队空间"请用 teams） */
    team() {
      return this.currentType === SPACE_TYPE.TEAM ? this.current : null
    },

    /** 当前空间 id（图片接口需要的 spaceId） */
    currentId() {
      return this.current?.id || ''
    },

    currentName() {
      return this.current?.spaceName || ''
    },

    currentLevel() {
      return this.current?.spaceLevel ?? 0
    },

    /** 当前是否为团队空间 */
    isTeam: (state) => state.currentType === SPACE_TYPE.TEAM,

    /** 当前空间是否已创建（未探测时为 false，页面按 loading 处理） */
    hasCurrent() {
      return Boolean(this.current)
    },

    /** 我创建的团队空间（admin 角色只随创建产生，至多一个） */
    myTeam(state) {
      return state.teams.find((item) => item.spaceRole === SPACE_ROLE.ADMIN) || null
    },

    /** 我被邀请加入的团队空间 */
    joinedTeams(state) {
      return state.teams.filter((item) => item.spaceRole !== SPACE_ROLE.ADMIN)
    },

    /** 是否已经创建了属于自己的团队空间 */
    hasOwnTeam() {
      return Boolean(this.myTeam)
    },

    /**
     * 当前空间里「我」的角色
     * 个人空间是所有者，权限等同 admin；团队空间取后端回填的 spaceRole。
     */
    role() {
      if (!this.isTeam) return SPACE_ROLE.ADMIN
      return this.current?.spaceRole || SPACE_ROLE.ADMIN
    },

    /** 当前角色是否具备某个权限码（真正的拦截在后端，这里只用于按钮显示判断） */
    hasPermission() {
      return (permission) => (SPACE_ROLE_PERMISSIONS[this.role] || []).includes(permission)
    },

    canUpload() {
      return Boolean(this.current) && (!this.isTeam || this.hasPermission('picture:add'))
    },
    canEdit() {
      return Boolean(this.current) && (!this.isTeam || this.hasPermission('picture:update'))
    },
    canDelete() {
      return Boolean(this.current) && (!this.isTeam || this.hasPermission('picture:delete'))
    },
    /** 改名 / 升级走 /space/update，后端只放行空间创建者（团队成员会被拒） */
    canManageSpace() {
      return Boolean(this.current) && (!this.isTeam || this.role === SPACE_ROLE.ADMIN)
    },
    /** 成员管理是团队空间 admin 的专属能力 */
    canManageMembers() {
      return this.isTeam && this.role === SPACE_ROLE.ADMIN
    },

    /** 已用百分比，0 ~ 100 */
    usedPercent() {
      const max = Number(this.current?.maxSize || 0)
      if (max <= 0) return 0
      return Math.min(100, Math.round((Number(this.current?.totalSize || 0) / max) * 100))
    },

    /** 剩余百分比，0 ~ 100（满容后不会出现负数） */
    freePercent() {
      const max = Number(this.current?.maxSize || 0)
      if (max <= 0) return 0
      return Math.max(0, Math.min(100, Math.round((1 - Number(this.current?.totalSize || 0) / max) * 100)))
    },

    /** 剩余容量（字节），不少于 0 */
    freeSize() {
      const max = Number(this.current?.maxSize || 0)
      const used = Number(this.current?.totalSize || 0)
      return Math.max(0, max - used)
    },

    /**
     * 空间切换器的可选项（分组：个人空间 / 我创建的团队空间 / 我加入的团队空间）
     * value 统一为 'personal' 或 'team:{id}'
     */
    switchOptions(state) {
      const personalGroup = {
        label: '个人空间',
        options: [{ value: 'personal', label: state.personal?.spaceName || '个人空间（未创建）' }]
      }
      if (!state.teams.length) return [personalGroup]

      const mine = state.teams.filter((item) => item.spaceRole === SPACE_ROLE.ADMIN)
      const joined = state.teams.filter((item) => item.spaceRole !== SPACE_ROLE.ADMIN)
      const toOption = (item) => ({ value: `team:${item.id}`, label: item.spaceName || '团队空间' })
      const groups = []
      if (mine.length) groups.push({ label: '我创建的团队空间', options: mine.map(toOption) })
      if (joined.length) groups.push({ label: '我加入的团队空间', options: joined.map(toOption) })
      return [personalGroup, ...groups]
    },

    /** 当前空间在切换器中的 value */
    currentKey(state) {
      return state.currentType === SPACE_TYPE.TEAM ? `team:${state.currentTeamId}` : 'personal'
    }
  },

  actions: {
    reset() {
      this.probed = false
      this.loading = false
      this.personal = null
      this.teams = []
      this.currentType = SPACE_TYPE.PERSONAL
      this.currentTeamId = ''
      this.members = []
      this.membersLoading = false
    },

    /** 切换用户时载入其本地缓存（只做快速回显，是否真的存在仍以服务端探测为准） */
    restore(userId) {
      this.reset()
      try {
        const raw = localStorage.getItem(storageKey(userId))
        if (!raw) return
        const data = JSON.parse(raw)
        this.personal = normalizeSpace(data.personal, SPACE_TYPE.PERSONAL)
        // 兼容旧缓存：早期版本只存了单个 team
        const cachedTeams = Array.isArray(data.teams) ? data.teams : data.team ? [data.team] : []
        this.teams = normalizeList(cachedTeams, SPACE_TYPE.TEAM)
        this.currentType = Number(data.currentType ?? SPACE_TYPE.PERSONAL)
        this.currentTeamId = data.currentTeamId ? String(data.currentTeamId) : ''
        this.syncCurrent()
      } catch (e) {
        /* 缓存损坏则忽略，重新探测即可 */
      }
    },

    persist(userId) {
      localStorage.setItem(
        storageKey(userId),
        JSON.stringify({
          currentType: this.currentType,
          currentTeamId: this.currentTeamId,
          personal: this.personal,
          teams: this.teams
        })
      )
    },

    clearLocal(userId) {
      localStorage.removeItem(storageKey(userId))
    },

    /**
     * 当前指向的空间不存在时自动回落：团队 id 失效就切到第一个团队空间，
     * 一个团队空间都没有就回落到个人空间。
     */
    syncCurrent() {
      if (this.currentType !== SPACE_TYPE.TEAM) return
      const exists = this.teams.some((item) => item.id === this.currentTeamId)
      if (!exists) {
        this.currentTeamId = this.teams[0]?.id || ''
        if (!this.currentTeamId) this.currentType = SPACE_TYPE.PERSONAL
      }
    },

    /**
     * 切换当前查看的空间
     * @param {string} key 'personal' 或 'team:{id}'（见 switchOptions）
     * @param {string|number} userId 当前用户 id（用于本地缓存分桶）
     */
    setCurrent(key, userId) {
      const value = String(key || '')
      if (value.startsWith('team:')) {
        this.currentType = SPACE_TYPE.TEAM
        this.currentTeamId = value.slice(5)
      } else {
        this.currentType = SPACE_TYPE.PERSONAL
        this.currentTeamId = ''
      }
      this.persist(userId)
    },

    /** 切到指定团队空间（按 id），用于上传后回空间页定位 */
    setCurrentTeam(spaceId, userId) {
      this.currentType = SPACE_TYPE.TEAM
      this.currentTeamId = String(spaceId || '')
      this.persist(userId)
    },

    /**
     * 探测当前用户的空间：个人空间 + 我的团队空间列表
     * 未登录 / 网络异常时保持 probed = false，避免误判成「未创建空间」。
     * @param {string|number} userId 当前用户 id（用于本地缓存分桶）
     * @param {boolean} force 是否强制刷新
     */
    async load(userId, force = false) {
      if (this.loading) return
      if (this.probed && !force) return
      this.loading = true
      try {
        const [personal, teams] = await Promise.all([this.fetchPersonal(), this.fetchMyTeams()])
        this.personal = personal
        this.teams = teams
        this.probed = true
        this.syncCurrent()
        this.persist(userId)
      } catch (e) {
        this.probed = false
        throw e
      } finally {
        this.loading = false
      }
    },

    /** 查询当前用户的个人空间（未创建返回 null） */
    async fetchPersonal() {
      const detail = await querySpaceById('', SPACE_TYPE.PERSONAL, { silent: true })
      return detail || null
    },

    /** 查询我的团队空间列表（我创建的 + 我加入的） */
    async fetchMyTeams() {
      const list = await queryMySpaceList({ silent: true })
      return normalizeList(list, SPACE_TYPE.TEAM)
    },

    /**
     * 只刷新当前空间的容量与图片数（改名 / 上传图片后调用）
     * 加入的团队空间不能按 spaceType 查「自己的空间」，统一重拉团队列表后取当前项。
     */
    async refreshUsage(userId) {
      try {
        if (this.currentType === SPACE_TYPE.TEAM) {
          this.teams = await this.fetchMyTeams()
          // 已被移除 / 空间被删：该空间从列表中消失，syncCurrent 会自动回落
          this.syncCurrent()
        } else {
          const space = await this.fetchPersonal()
          this.personal = space
        }
        this.persist(userId)
      } catch (e) {
        /* 容量刷新失败不影响主流程 */
      }
    },

    /**
     * 创建空间
     * @param {string|number} userId 当前用户 id
     * @param {object} payload { spaceName, spaceType }
     */
    async create(userId, payload) {
      const spaceType = Number(payload?.spaceType ?? SPACE_TYPE.PERSONAL)
      const spaceName = payload?.spaceName?.trim() || undefined
      await createSpace({ spaceName, spaceType })
      // 创建成功后重新探测，直接用服务端返回的容量 / 名称，避免前端拼的值和库里不一致
      await this.load(userId, true)
      if (spaceType === SPACE_TYPE.TEAM) {
        // 新建的团队空间：定位到「我创建的那一个」（列表里 spaceRole 为 admin 的）
        this.currentType = SPACE_TYPE.TEAM
        this.currentTeamId = this.myTeam?.id || ''
        this.syncCurrent()
      } else {
        this.currentType = SPACE_TYPE.PERSONAL
      }
      this.persist(userId)
    },

    /** 修改当前空间名称（仅空间创建者可用，后端会拦截团队成员） */
    async rename(userId, spaceName) {
      await updateSpace({ spaceId: this.currentId, spaceName })
      await this.refreshUsage(userId)
    },

    /**
     * 付费升级当前空间版本（提交 spaceId + spaceLevel，expandSize 传 0 表示不额外扩容）
     * 后端需放开「本人升级自己空间」的权限校验后本操作才可用。
     */
    async upgrade(userId, spaceLevel) {
      await updateSpace({ spaceId: this.currentId, spaceLevel, expandSize: 0 })
      await this.refreshUsage(userId)
    },

    /** 载入当前团队空间的成员列表 */
    async loadMembers() {
      const spaceId = this.isTeam ? this.currentId : ''
      if (!spaceId) {
        this.members = []
        return
      }
      this.membersLoading = true
      try {
        const list = await querySpaceUserList({ spaceId }, { silent: true })
        this.members = Array.isArray(list) ? list : []
      } catch (e) {
        this.members = []
        throw e
      } finally {
        this.membersLoading = false
      }
    },

    /**
     * 邀请成员加入团队空间
     * @param {object} payload { userId, spaceRole } spaceRole 仅 viewer / editor
     */
    async inviteMember(payload) {
      await addSpaceUser({
        spaceId: this.isTeam ? this.currentId : '',
        userId: payload?.userId,
        spaceRole: payload?.spaceRole
      })
      await this.loadMembers()
    },

    /** 移除团队空间成员（admin 不能被移除，后端会直接拒绝） */
    async removeMember(userId) {
      await removeSpaceUser({ spaceId: this.isTeam ? this.currentId : '', userId })
      await this.loadMembers()
    },

    /**
     * 修改团队空间成员的角色（只能在 viewer / editor 之间互改，创建者 admin 不可改）
     * @param {object} payload { userId, spaceRole }
     */
    async updateMemberRole(payload) {
      await updateSpaceUser({
        spaceId: this.isTeam ? this.currentId : '',
        userId: payload?.userId,
        spaceRole: payload?.spaceRole
      })
      await this.loadMembers()
    },

    /** 重拉「我的团队空间」列表：别人改了我在某个空间的角色后，同步我自己的角色 */
    async refreshMyRole() {
      this.teams = await this.fetchMyTeams()
      this.syncCurrent()
    },

    /** 切回个人空间时清掉上一个团队空间的成员列表，避免串空间展示 */
    clearMembers() {
      this.members = []
    }
  }
})
