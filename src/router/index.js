import { createRouter, createWebHistory } from 'vue-router'
import { message } from 'ant-design-vue'
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
        meta: { title: '上传图片', auth: true }
      },
      {
        path: 'my',
        name: 'my-pictures',
        component: () => import('@/views/MyPictures.vue'),
        meta: { title: '图片管理', auth: true }
      },
      {
        path: 'space',
        name: 'space',
        component: () => import('@/views/SpaceManage.vue'),
        meta: { title: '我的空间', auth: true }
      },
      {
        // 私有图库已并入「我的空间」，空间页在概览下方直接展示私有图片列表
        path: 'space/pictures',
        redirect: '/space'
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', auth: true }
      },
      {
        path: 'admin/pictures',
        name: 'admin-pictures',
        component: () => import('@/views/AdminPictures.vue'),
        meta: { title: '图片审核管理', auth: true, admin: true }
      },
      {
        path: 'admin/users',
        name: 'admin-users',
        component: () => import('@/views/AdminUsers.vue'),
        meta: { title: '用户管理', auth: true, admin: true }
      },
      {
        path: 'admin/categories',
        name: 'admin-categories',
        component: () => import('@/views/AdminCategories.vue'),
        meta: { title: '分类管理', auth: true, admin: true }
      },
      {
        path: 'admin/tags',
        name: 'admin-tags',
        component: () => import('@/views/AdminTags.vue'),
        meta: { title: '标签管理', auth: true, admin: true }
      },
      {
        path: 'admin/spaces',
        name: 'admin-spaces',
        component: () => import('@/views/AdminSpaces.vue'),
        meta: { title: '空间管理', auth: true, admin: true }
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

  if (to.meta.auth && !userStore.isLogin) {
    message.warning('请先登录后再访问该页面')
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
