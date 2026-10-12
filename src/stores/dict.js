import { defineStore } from 'pinia'
import { queryAdminCategoryList, queryCategoryList } from '@/api/category'
import { queryAdminTagList, queryTagList } from '@/api/tag'

/** 普通字典的 in-flight 请求，跨组件复用 */
let pendingLoad = null

/**
 * 分类 / 标签字典
 *
 * 后端只返回 categoryId 与 tagId，名称需要单独查询，这里统一缓存，
 * 让筛选、表单、表格展示都能用真实名称而不是裸 ID。
 *
 * 注意：/category/queryList 与 /tag/queryList 已加入后端登录白名单，游客也可拉取；
 * 后续若后端收紧白名单，这里拉取失败也只是保持空字典（展示层回退成 #id），不影响页面。
 */
export const useDictStore = defineStore('dict', {
  state: () => ({
    categories: [],
    tags: [],
    adminCategories: [],
    adminTags: [],
    /** 普通字典是否已成功加载 */
    loaded: false,
    /** 管理端字典是否已成功加载 */
    adminLoaded: false,
    loading: false
  }),

  getters: {
    categoryOptions: (state) => state.categories.map((c) => ({ value: c.id, label: c.categoryName })),
    tagOptions: (state) => state.tags.map((t) => ({ value: t.id, label: t.tagName })),

    /** id -> 分类名，统一用字符串 key 匹配（图片里的 id 可能是数字也可能是字符串） */
    categoryMap: (state) =>
      state.categories.reduce((acc, c) => {
        acc[String(c.id)] = c.categoryName
        return acc
      }, {}),

    tagMap: (state) =>
      state.tags.reduce((acc, t) => {
        acc[String(t.id)] = t.tagName
        return acc
      }, {}),

    /** 分类名；字典里没有时回退成 #id，避免旧数据展示成空白 */
    categoryName: (state) => (id) => {
      if (id === null || id === undefined || id === '') return ''
      return state.categories.find((c) => String(c.id) === String(id))?.categoryName || `#${id}`
    },

    tagName: (state) => (id) => {
      if (id === null || id === undefined || id === '') return ''
      return state.tags.find((t) => String(t.id) === String(id))?.tagName || `#${id}`
    },

    /** 一组标签 id -> 名称数组 */
    tagLabels: (state) => (ids) =>
      (Array.isArray(ids) ? ids : [])
        .filter((id) => id !== null && id !== undefined)
        .map((id) => state.tags.find((t) => String(t.id) === String(id))?.tagName || `#${id}`)
  },

  actions: {
    /**
     * 加载普通字典（下拉选项用）。已加载过则跳过，force 用于管理端改完强制刷新。
     * 并发调用共享同一个 in-flight 请求，避免多个组件同时挂载时后面的调用空手返回。
     * @param {boolean} force 是否强制刷新
     */
    load(force = false) {
      if (this.loaded && !force) return Promise.resolve()
      if (pendingLoad && !force) return pendingLoad
      this.loading = true
      pendingLoad = Promise.all([queryCategoryList(), queryTagList()])
        .then(([categories, tags]) => {
          this.categories = Array.isArray(categories) ? categories : []
          this.tags = Array.isArray(tags) ? tags : []
          this.loaded = true
        })
        .catch(() => {
          // 未登录或接口异常时保持空字典，展示层会回退成 #id
          if (force) {
            this.categories = []
            this.tags = []
          }
        })
        .finally(() => {
          this.loading = false
          pendingLoad = null
        })
      return pendingLoad
    },

    /** 加载管理端字典（含创建 / 编辑时间） */
    async loadAdmin(force = false) {
      if (this.adminLoaded && !force) return
      try {
        const [categories, tags] = await Promise.all([
          queryAdminCategoryList(),
          queryAdminTagList()
        ])
        this.adminCategories = Array.isArray(categories) ? categories : []
        this.adminTags = Array.isArray(tags) ? tags : []
        this.adminLoaded = true
      } catch (e) {
        /* 无权限时列表保持为空，页面会给出提示 */
      }
    },

    /** 管理端增删改后调用：让全站下拉与展示拿到最新名称 */
    async refreshAll() {
      this.adminLoaded = false
      await Promise.all([this.load(true), this.loadAdmin(true)])
    },

    reset() {
      this.categories = []
      this.tags = []
      this.adminCategories = []
      this.adminTags = []
      this.loaded = false
      this.adminLoaded = false
    }
  }
})
