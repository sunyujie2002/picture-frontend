import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './styles/global.less'

import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'

dayjs.locale('zh-cn')

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(Antd)

// 在挂载前应用主题，避免浅色→深色的闪白（深色模式首帧直接用深色底色渲染）
useThemeStore(pinia).init()

app.mount('#app')
