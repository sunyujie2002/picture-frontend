import { createRouter, createWebHistory } from 'vue-router'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { NOT_LOGIN_MESSAGE } from '@/constants'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', blank: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册', blank: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/BasicLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '图库首页' }
      },
      {
        path: 'picture/:id',
        name: 'picture-detail',
        component: () => import('@/views/PictureDetail.vue'),
        meta: { title: '图片详情' }
      },
      {
        path: 'upload',
        name: 'upload',
        component: () => import('@/views/UploadPicture.vue'),
        meta: { title: '上传图片' }
      },
      {
        path: 'my',
        name: 'my-pictures',
        component: () => import('@/views/MyPictures.vue'),
        meta: { title: '图片管理' }
      },
      {
        path: 'space',
        name: 'space',
        component: () => import('@/views/SpaceManage.vue'),
        meta: { title: '我的空间' }
      },
      {
        // 私有图库已并入「我的空间」，空间页在概览下方直接展示私有图片列表
        path: 'space/pictures',
        redirect: '/space'
      },
      {
        path: 'space/analysis',
        name: 'space-analysis',
        component: () => import('@/views/SpaceAnalysis.vue'),
        meta: { title: '数据分析' }
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心' }
      },
      {
        path: 'admin/pictures',
        name: 'admin-pictures',
        component: () => import('@/views/AdminPictures.vue'),
        meta: { title: '图片审核管理', admin: true }
      },
      {
        path: 'admin/users',
        name: 'admin-users',
        component: () => import('@/views/AdminUsers.vue'),
        meta: { title: '用户管理', admin: true }
      },
      {
        path: 'admin/categories',
        name: 'admin-categories',
        component: () => import('@/views/AdminCategories.vue'),
        meta: { title: '分类管理', admin: true }
      },
      {
        path: 'admin/tags',
        name: 'admin-tags',
        component: () => import('@/views/AdminTags.vue'),
        meta: { title: '标签管理', admin: true }
      },
      {
        path: 'admin/spaces',
        name: 'admin-spaces',
        component: () => import('@/views/AdminSpaces.vue'),
        meta: { title: '空间管理', admin: true }
      },
      {
        path: 'admin/ranking',
        name: 'admin-ranking',
        component: () => import('@/views/AdminRanking.vue'),
        meta: { title: '空间用量排行', admin: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

/**
 * 未登录可访问的路由白名单（路由名），其余一律拦截。
 *
 * 后端只能管接口，管不到路由，所以路由这层得前端自己「做死」：
 * 不逐个路由标记是否需要登录，而是默认全部需要登录、只放行下面这几个，
 * 新增页面忘记标记也不会漏。
 *
 * 放行项说明：
 * - home：公共图库浏览（列表接口已加入后端白名单）
 * - picture-detail：游客能看列表就该能点进详情（详情接口同样已放行）
 * - login / register：登录注册本身
 * - not-found：兜底页，不拦（否则未登录访问不存在的地址会先跳登录）
 */
const PUBLIC_ROUTE_NAMES = ['home', 'picture-detail', 'login', 'register', 'not-found']

router.beforeEach(async (to) => {
  const userStore = useUserStore()

  // 已登录但用户信息未加载时补齐，用于菜单权限判断
  if (userStore.isLogin && !userStore.userInfo) {
    await userStore.fetchUserInfo()
  }

  // 未登录一律只放行白名单路由，其余先提示再跳登录页（带 redirect，登录后回到原地址）。
  // 提示文案与接口 40100 / 401 完全一致，都是 NOT_LOGIN_MESSAGE。
  // 接口层仍由后端判定权限，这里的拦截是页面入口层面的「做死」，两者不冲突。
  if (!PUBLIC_ROUTE_NAMES.includes(to.name) && !userStore.isLogin) {
    message.error(NOT_LOGIN_MESSAGE)
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.admin && !userStore.isAdmin) {
    return { name: 'home' }
  }

  // 已登录用户访问登录/注册页直接回首页
  if ((to.name === 'login' || to.name === 'register') && userStore.isLogin) {
    return { name: 'home' }
  }

  if (to.meta.title) {
    document.title = `${to.meta.title} · 图库`
  }
  return true
})

export default router
