<template>
  <div class="layout">
    <header class="header" :class="{ 'header-scrolled': scrolled }">
      <div class="header-inner">
        <router-link to="/" class="logo">
          <span class="logo-mark">
            <PictureOutlined />
          </span>
          <span class="logo-text">图库</span>
        </router-link>

        <nav class="nav">
          <a-menu
            v-model:selectedKeys="selectedKeys"
            mode="horizontal"
            :items="menuItems"
            class="nav-menu"
            @click="handleMenuClick"
          />
        </nav>

        <div class="header-right">
          <template v-if="userStore.isLogin">
            <a-dropdown placement="bottomRight">
              <div class="user-chip">
                <a-avatar :src="resolveImageUrl(userStore.avatarUrl)" :size="32" class="user-avatar">
                  {{ userStore.displayName.charAt(0) }}
                </a-avatar>
                <span class="user-name">{{ userStore.displayName }}</span>
                <a-tag v-if="userStore.isAdmin" color="red" class="role-tag">管理员</a-tag>
                <DownOutlined class="arrow" />
              </div>
              <template #overlay>
                <a-menu @click="handleUserMenuClick">
                  <a-menu-item key="profile">
                    <UserOutlined />
                    个人中心
                  </a-menu-item>
                  <a-menu-item key="my">
                    <AppstoreOutlined />
                    图片管理
                  </a-menu-item>
                  <a-menu-item key="private">
                    <LockOutlined />
                    我的空间
                  </a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="logout" danger>
                    <LogoutOutlined />
                    退出登录
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </template>
          <template v-else>
            <a-button type="text" @click="goLogin">登录</a-button>
            <a-button type="primary" @click="goRegister">注册</a-button>
          </template>
        </div>
      </div>
    </header>

    <main class="content">
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="footer">
      <div class="footer-inner">
        <span class="footer-brand">图库 · PictureHub</span>
        <span class="footer-text">上传、检索与管理，让每一张图片都被找到</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import {
  AppstoreOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DownOutlined,
  FolderOpenOutlined,
  LockOutlined,
  LogoutOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useDictStore } from '@/stores/dict'
import { useSpaceStore } from '@/stores/space'
import { resolveImageUrl } from '@/utils/image'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const dictStore = useDictStore()
const spaceStore = useSpaceStore()
const scrolled = ref(false)

const selectedKeys = ref([])

const menuItems = computed(() => {
  const items = [
    { key: '/', icon: () => h(PictureOutlined), label: '图库首页' },
    { key: '/upload', icon: () => h(CloudUploadOutlined), label: '上传图片' },
    // 公共图片管理列表对所有登录用户都只返回自己上传的图片，管理员与普通用户共用同一入口
    { key: '/my', icon: () => h(AppstoreOutlined), label: '图片管理' },
    // 个人空间与团队空间共用一个页面，页内按空间类型切换
    { key: '/space', icon: () => h(DatabaseOutlined), label: '我的空间' }
  ]

  if (userStore.isAdmin) {
    items.push({
      key: 'admin',
      icon: () => h(SafetyCertificateOutlined),
      label: '管理后台',
      children: [
        { key: '/admin/pictures', icon: () => h(SafetyCertificateOutlined), label: '图片审核' },
        { key: '/admin/users', icon: () => h(TeamOutlined), label: '用户管理' },
        { key: '/admin/categories', icon: () => h(AppstoreOutlined), label: '分类管理' },
        { key: '/admin/tags', icon: () => h(TagsOutlined), label: '标签管理' },
        { key: '/admin/spaces', icon: () => h(FolderOpenOutlined), label: '空间管理' },
        { key: '/admin/ranking', icon: () => h(BarChartOutlined), label: '空间用量排行' }
      ]
    })
  }
  return items
})

// 预热分类 / 标签字典，让筛选、表单与表格展示用得上真实名称。
// 这两个接口已对游客放行，游客逛公共图库同样要用，所以不做登录态判断；
// 需要登录的接口交给后端返回 40100，由请求拦截器统一提示并跳转。
dictStore.load()

// 切换用户时载入其空间本地记录（真正的空间状态由各页面按需探测）
watch(
  () => userStore.userId,
  (userId) => {
    spaceStore.restore(userId)
  },
  { immediate: true }
)

// 依据当前路由高亮菜单（子路由归属到父级分组）
watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/admin')) {
      selectedKeys.value = [path]
    } else if (path.startsWith('/picture/')) {
      selectedKeys.value = ['/']
    } else {
      selectedKeys.value = [path]
    }
  },
  { immediate: true }
)

function handleMenuClick({ key }) {
  if (key && key !== 'admin') {
    router.push(key)
  }
}

function handleUserMenuClick({ key }) {
  if (key === 'logout') {
    Modal.confirm({
      title: '确认退出登录？',
      content: '退出后需要重新登录才能继续操作。',
      okText: '退出登录',
      cancelText: '取消',
      onOk: async () => {
        await userStore.logout()
        router.push('/login')
      }
    })
    return
  }
  if (key === 'profile') router.push('/profile')
  if (key === 'my') router.push('/my')
  if (key === 'private') router.push('/space')
}

function goLogin() {
  router.push({ name: 'login', query: { redirect: route.fullPath } })
}

function goRegister() {
  router.push({ name: 'register' })
}

function onScroll() {
  scrolled.value = window.scrollY > 8
}

// token 失效（后端返回 40100 / HTTP 401）时统一清理并跳转登录。
// 不区分当前页面是否需要登录：错误提示由请求拦截器统一弹出（用的是后端返回的 message），
// 这里只负责跳转，前端不再自行预判哪些操作需要登录。
function handleUnauthorized() {
  userStore.clearLocal()
  // 已在登录 / 注册页时不再跳转，避免死循环
  if (route.name === 'login' || route.name === 'register') return
  router.push({ name: 'login', query: { redirect: route.fullPath } })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('app:unauthorized', handleUnauthorized)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('app:unauthorized', handleUnauthorized)
})
</script>

<style scoped lang="less">
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.header-scrolled {
  border-bottom-color: var(--border);
  box-shadow: 0 1px 3px rgba(31, 36, 48, 0.05);
}

.header-inner {
  max-width: 1360px;
  height: 64px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.logo-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 17px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 55%, #7c3aed 100%);
  box-shadow: 0 4px 12px -3px rgba(79, 70, 229, 0.5);
}

.logo-text {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.2px;
  color: var(--text);
}

.nav {
  flex: 1;
  min-width: 0;
}

.nav-menu {
  border-bottom: none;
  background: transparent;
  line-height: 62px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.user-chip:hover {
  background: #f3f4f8;
}

.user-avatar {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
}

.user-name {
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.role-tag {
  margin: 0;
  line-height: 18px;
}

.arrow {
  font-size: 11px;
  color: var(--text-tertiary);
}

.content {
  flex: 1;
  min-height: 0;
}

.footer {
  border-top: 1px solid var(--border);
  background: #fff;
}

.footer-inner {
  max-width: 1360px;
  margin: 0 auto;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.footer-brand {
  font-weight: 600;
  color: var(--text);
}

.footer-text {
  font-size: 13px;
  color: var(--text-tertiary);
}

@media (max-width: 900px) {
  .nav-menu {
    display: none;
  }
}

@media (max-width: 560px) {
  .logo-text,
  .user-name,
  .role-tag {
    display: none;
  }
}
</style>
