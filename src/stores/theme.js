import { defineStore } from 'pinia'

const STORAGE_KEY = 'picture_theme' // 取值：'light' | 'dark'

/** 读取初始主题：优先用用户已保存的选择，否则默认浅色 */
function getInitialMode() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  }
  return 'light'
}

/** 把主题写到 <html data-theme> 与 color-scheme，供 CSS 变量与浏览器原生控件（滚动条等）跟随 */
function applyMode(mode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: getInitialMode()
  }),

  getters: {
    isDark: (state) => state.mode === 'dark'
  },

  actions: {
    /** 应用启动（挂载前）调用一次，避免浅色→深色的闪白 */
    init() {
      applyMode(this.mode)
    },

    /** 在浅色 / 深色之间切换 */
    toggle() {
      this.setMode(this.mode === 'dark' ? 'light' : 'dark')
    },

    /** 显式设置模式并持久化 */
    setMode(mode) {
      if (mode !== 'light' && mode !== 'dark') return
      this.mode = mode
      applyMode(mode)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, mode)
      }
    }
  }
})
