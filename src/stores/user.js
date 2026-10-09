import { defineStore } from 'pinia'
import { getToken, setToken } from '@/api/request'
import { getLoginUser, login as loginApi, logout as logoutApi, register as registerApi } from '@/api/user'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    userInfo: null,
    /** 是否已尝试拉取过登录用户信息，避免重复请求 */
    fetched: false
  }),

  getters: {
    isLogin: (state) => Boolean(state.token),
    isAdmin: (state) => state.userInfo?.userRole === 'admin',
    userId: (state) => state.userInfo?.id ?? null,
    displayName: (state) => state.userInfo?.userName || state.userInfo?.userAccount || '未登录',
    avatarUrl: (state) => state.userInfo?.userAvatar || ''
  },

  actions: {
    /** 登录并拉取用户信息 */
    async login(payload) {
      const token = await loginApi(payload)
      this.token = token
      setToken(token)
      this.fetched = false
      await this.fetchUserInfo()
      return token
    },

    /** 注册（注册成功不自动登录，返回 userId） */
    async register(payload) {
      return registerApi(payload)
    },

    /** 拉取当前登录用户 */
    async fetchUserInfo(force = false) {
      if (!this.token) {
        this.userInfo = null
        return null
      }
      if (this.fetched && !force && this.userInfo) return this.userInfo
      try {
        this.userInfo = await getLoginUser()
        this.fetched = true
      } catch (e) {
        this.userInfo = null
        this.fetched = true
      }
      return this.userInfo
    },

    /** 退出登录 */
    async logout() {
      try {
        await logoutApi()
      } catch (e) {
        /* 后端异常也要清理本地态 */
      }
      this.clearLocal()
    },

    /** 仅清理本地登录态（用于 token 失效场景） */
    clearLocal() {
      this.token = ''
      this.userInfo = null
      this.fetched = false
      setToken('')
    }
  }
})
