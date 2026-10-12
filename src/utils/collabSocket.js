import { ref } from 'vue'
import { getToken } from '@/api/request'

/**
 * 协作 WebSocket 客户端
 *
 * 封装三件事：鉴权地址拼装、断线重连、心跳保活。
 * 之所以要自己做重连：团队协作过程中网络抖动很常见，
 * 连接断了但用户在页面上有未提交思路时，自动恢复比重开页面友好得多。
 */

const CONNECT_STATUS = {
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSED: 'closed'
}

/**
 * 根据 API 基址推导 WebSocket 地址
 * 开发环境形如 /api → ws://localhost:3000/api/ws/picture/edit（走 vite 代理升级）
 * 生产环境形如 http://host/api → ws://host/api/ws/picture/edit
 */
function buildWsUrl(pictureId, token) {
  const rawBase = import.meta.env.VITE_API_BASE_URL || '/api'
  const base = String(rawBase).replace(/\/+$/, '')
  let wsBase
  if (/^https?:\/\//i.test(base)) {
    wsBase = base.replace(/^http/i, 'ws')
  } else {
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    wsBase = `${scheme}//${window.location.host}${base.startsWith('/') ? base : '/' + base}`
  }
  const query = new URLSearchParams({ pictureId: String(pictureId), token: token || '' })
  return `${wsBase}/ws/picture/edit?${query.toString()}`
}

/**
 * 建立协作连接
 *
 * @param {Object}   options
 * @param {string}   options.pictureId 房间标识（图片 id）
 * @param {Function} options.onMessage 收到服务端下行消息时的回调
 * @param {Function} [options.onStatusChange] 连接状态变化回调
 * @param {Function} [options.onFatal] 鉴权失败等不可恢复错误
 * @returns {{ send, close, status, queue }}
 */
export function createCollabSocket({ pictureId, onMessage, onStatusChange, onFatal }) {
  const status = ref(CONNECT_STATUS.CONNECTING)
  const queue = ref([])

  let socket = null
  let heartbeatTimer = null
  let retryTimer = null
  let manualClosed = false
  let retryCount = 0

  const MAX_RETRY = 5
  const HEARTBEAT_INTERVAL = 30000

  function setStatus(next) {
    status.value = next
    onStatusChange?.(next)
  }

  function clearHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function startHeartbeat() {
    clearHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', payload: null }))
      }
    }, HEARTBEAT_INTERVAL)
  }

  function flushQueue() {
    if (queue.value.length && socket && socket.readyState === WebSocket.OPEN) {
      queue.value.forEach((item) => socket.send(item))
      queue.value = []
    }
  }

  function connect() {
    if (manualClosed) {
      return
    }
    const token = getToken()
    if (!token) {
      onFatal?.('未登录')
      setStatus(CONNECT_STATUS.CLOSED)
      return
    }
    setStatus(CONNECT_STATUS.CONNECTING)

    try {
      socket = new WebSocket(buildWsUrl(pictureId, token))
    } catch (e) {
      onFatal?.('连接建立失败')
      setStatus(CONNECT_STATUS.CLOSED)
      return
    }

    socket.onopen = () => {
      retryCount = 0
      setStatus(CONNECT_STATUS.OPEN)
      startHeartbeat()
      flushQueue()
    }

    socket.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch (e) {
        return
      }
      if (message.type === 'error') {
        // 错误是提示性内容，不致命，交给上层展示
        onMessage?.(message)
        return
      }
      onMessage?.(message)
    }

    socket.onerror = () => {
      // 真正的失败原因不单独处理，统一由 onclose 走重连
    }

    socket.onclose = (event) => {
      clearHeartbeat()
      setStatus(CONNECT_STATUS.CLOSED)
      // 4000 以上是服务端明确拒绝（未登录 / 无权限），不该再重试
      const fatal = event.code >= 4000 || manualClosed
      if (fatal) {
        onFatal?.(event.code >= 4000 ? '没有编辑权限' : '连接已关闭')
        return
      }
      if (retryCount >= MAX_RETRY) {
        onFatal?.('网络不稳定，已停止重连')
        return
      }
      const delay = Math.min(1000 * 2 ** retryCount, 10000)
      retryCount += 1
      retryTimer = setTimeout(connect, delay)
    }
  }

  /**
   * 发送消息；连接未就绪时先排队，恢复后补发，避免用户操作在低概率抖动期丢失
   */
  function send(type, payload) {
    const body = JSON.stringify({ type, payload })
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(body)
      return true
    }
    queue.value.push(body)
    return false
  }

  function close() {
    manualClosed = true
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    clearHeartbeat()
    if (socket) {
      socket.close()
      socket = null
    }
    setStatus(CONNECT_STATUS.CLOSED)
  }

  connect()

  return { send, close, status, CONNECT_STATUS }
}
