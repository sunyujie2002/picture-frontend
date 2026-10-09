<template>
  <a-config-provider :theme="theme" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN'

// 设计令牌：现代简约浅色 —— 靛蓝品牌色 + 大圆角 + 柔和阴影
const theme = {
  token: {
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
  },
  components: {
    Button: { fontWeight: 500 },
    Card: { paddingLG: 24 },
    Table: { headerBg: '#FAFBFD', headerSplitColor: 'transparent' },
    Menu: { itemBorderRadius: 8, itemHeight: 40 },
    Modal: { titleFontSize: 17 },
    Tag: { defaultBg: '#F3F4F8', defaultColor: '#5A6172' }
  }
}
</script>
