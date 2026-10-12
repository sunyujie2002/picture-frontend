import axios from 'axios'
import { message } from 'ant-design-vue'
import { NOT_LOGIN_MESSAGE } from '@/constants'

const TOKEN_KEY = 'picture_token'

/** 后端约定：code = 0 表示成功，其余为业务错误（见 ErrorCode） */
const SUCCESS_CODE = 0
/** ErrorCode.NOT_LOGIN_ERROR */
const NOT_LOGIN_CODE = 40100

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

/**
 * ID 精度约定（重要）
 *
 * 后端 JsonConfig 把 Long / long 统一注册为 ToStringSerializer，所有 Long 字段（id、
 * userId、categoryId、tagId、spaceId…）在响应里都是 JSON 字符串。
 * 雪花 ID 有 19 位，远超 JS 的 Number.MAX_SAFE_INTEGER（16 位），一旦转成 Number，
 * 末尾几位会被抹成 0，导致查询 / 删除 / 修改命中不到记录。
 *
 * 因此前端全程以字符串保存和传递 ID：不要对 ID 用 Number()、parseInt 或 a-input-number，
 * 提交给后端时保持字符串即可（Jackson 会自动把数字字符串反序列化成 Long）。
 * 仅 picScale、picSize、分页总数这类非 ID 数值允许转成 Number 做格式化。
 */
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60000
})

// 请求拦截：除登录/注册外，后端 LoginInterceptor 要求所有请求携带 Authorization: token
request.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = token
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    const body = response.data

    // 非 JSON 响应（网关错误页等）直接放行原始内容
    if (!body || typeof body !== 'object' || typeof body.code !== 'number') {
      return body
    }

    const { code, data, message: msg } = body

    if (code === SUCCESS_CODE) {
      return data
    }

    if (code === NOT_LOGIN_CODE) {
      setToken('')
      // 通过全局事件通知登出，避免 request -> router -> store -> api 的循环依赖
      window.dispatchEvent(new CustomEvent('app:unauthorized'))
    }

    // silent：调用方自行处理业务错误，不弹全局提示（如探测用户是否已有空间）
    if (!response.config?.silent) {
      // 未登录提示统一用前端文案，与路由拦截说法一致（不用后端原文，避免两种说法）
      message.error(code === NOT_LOGIN_CODE ? NOT_LOGIN_MESSAGE : msg || '请求失败')
    }
    return Promise.reject(Object.assign(new Error(msg || '请求失败'), { code, data }))
  },
  (error) => {
    const status = error?.response?.status
    let tip = '网络异常，请稍后重试'
    // 401 同样按后端 NOT_LOGIN_ERROR 的口径提示，避免与业务码 40100 说法不一致
    if (status === 401) tip = NOT_LOGIN_MESSAGE
    else if (status === 403) tip = '当前用户无权限'
    else if (status === 404) tip = '请求的资源不存在'
    else if (status >= 500) tip = '服务器开小差了，请稍后重试'
    else if (error?.code === 'ECONNABORTED') tip = '请求超时，请稍后重试'

    if (status === 401) {
      setToken('')
      window.dispatchEvent(new CustomEvent('app:unauthorized'))
    }

    if (!error?.config?.silent) {
      message.error(tip)
    }
    return Promise.reject(error)
  }
)

export default request
