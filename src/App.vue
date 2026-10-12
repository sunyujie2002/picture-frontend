<template>
  <a-config-provider :theme="theme" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { theme as antTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const isDark = computed(() => themeStore.isDark)

// 浅色设计令牌：现代简约 —— 靛蓝品牌色 + 大圆角 + 柔和阴影
const lightTokens = {
  colorPrimary: '#4F46E5',
  colorSuccess: '#16A34A',
  colorWarning: '#F59E0B',
  colorError: '#EF4444',
  colorInfo: '#4F46E5',
  colorTextBase: '#1F2430',
  colorBgContainer: '#FFFFFF',
  colorBgLayout: '#F6F7FB',
  colorBorder: '#E8EAF0',
  colorBorderSecondary: '#F0F1F5',
  borderRadius: 10,
  fontSize: 14,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
  boxShadowSecondary:
    '0 1px 2px 0 rgba(31, 36, 48, 0.04), 0 4px 16px -4px rgba(31, 36, 48, 0.08)',
  controlHeight: 38
}

// 深色设计令牌：与 global.less 的 [data-theme='dark'] 配色保持一致，保证组件库与自定义样式统一
const darkTokens = {
  colorPrimary: '#818CF8',
  // 控件高度与浅色保持一致（否则切深色后原生输入框/下拉框回落到 AntD 默认 32px，和浅色 38px 对不上）
  controlHeight: 38,
  colorSuccess: '#22C55E',
  colorWarning: '#FBBF24',
  colorError: '#F87171',
  colorInfo: '#818CF8',
  colorTextBase: '#E6E8EE',
  colorBgContainer: '#17191E',
  colorBgElevated: '#1E222B',
  colorBgLayout: '#0F1115',
  colorBorder: '#2A2E38',
  colorBorderSecondary: '#232732',
  colorText: '#E6E8EE',
  colorTextSecondary: '#A0A6B4',
  colorTextTertiary: '#6B7280',
  boxShadowSecondary:
    '0 1px 2px 0 rgba(0, 0, 0, 0.4), 0 4px 16px -4px rgba(0, 0, 0, 0.5)'
}

// 组件级微调（深浅通用）
const componentTokens = {
  Button: { fontWeight: 500 },
  Card: { paddingLG: 24 },
  Table: { headerBg: '#FAFBFD', headerSplitColor: 'transparent' },
  Menu: { itemBorderRadius: 8, itemHeight: 40 },
  Modal: { titleFontSize: 17 },
  Tag: { defaultBg: '#F3F4F8', defaultColor: '#5A6172' }
}

const theme = computed(() => {
  if (isDark.value) {
    return {
      algorithm: antTheme.darkAlgorithm,
      token: darkTokens,
      components: {
        ...componentTokens,
        // 深色下的表头 / 标签底色，跟随我们的深色表面
        Table: { headerBg: '#1E222B', headerSplitColor: 'transparent' },
        Tag: { defaultBg: '#262A33', defaultColor: '#A0A6B4' }
      }
    }
  }
  return {
    token: lightTokens,
    components: componentTokens
  }
})
</script>
