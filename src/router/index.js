import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

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

router.beforeEach(async (to) => {
  const userStore = useUserStore()

  // 已登录但用户信息未加载时补齐，用于菜单权限判断
  if (userStore.isLogin && !userStore.userInfo) {
    await userStore.fetchUserInfo()
  }

  // 登录态不在前端拦截：统一由后端接口校验，返回 40100 时
  // BasicLayout 统一清登录态并跳转登录页，接口放行范围只改后端白名单即可
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
