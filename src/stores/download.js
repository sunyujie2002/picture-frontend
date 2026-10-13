import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { downloadPicture } from '@/utils/format'

let seq = 0

// 取消控制器单独存放，不进响应式 state：
// ① reactive 会深度代理 class 实例，WebIDL 对象（AbortController）被代理后
//    调用 abort() 会因内部槽检查失败报 Illegal invocation；
// ② 控制器也不是需要渲染的状态。
const controllers = new Map()

/**
 * 全局下载任务管理。
 *
 * 点击下载即刻创建任务并弹出进度面板（流式回调实时更新），
 * 支持多个下载并行、单个取消、完成后自动清理。
 * 任务状态：downloading / done / error。
 *
 * ⚠️ task 必须用 reactive() 包装后再 push：直接 push 普通对象的话，
 * 后续改的是原始对象而非响应式代理，视图不会更新（进度卡住不动的经典坑）。
 */
export const useDownloadStore = defineStore('download', {
  state: () => ({
    tasks: []
  }),
  getters: {
    hasTasks: (state) => state.tasks.length > 0
  },
  actions: {
    /** 发起一个下载任务，立即出现在下载面板中；返回任务 key */
    start(picture) {
      const key = `dl-${Date.now()}-${seq++}`
      const controller = new AbortController()
      controllers.set(key, controller)
      const task = reactive({
        key,
        name: buildTaskName(picture),
        loaded: 0,
        total: 0,
        status: 'downloading',
        error: ''
      })
      this.tasks.push(task)
      this.run(task, picture, controller)
      return key
    },

    async run(task, picture, controller) {
      try {
        await downloadPicture(picture, {
          signal: controller.signal,
          onProgress: ({ loaded, total }) => {
            task.loaded = loaded
            if (total) task.total = total
          }
        })
        task.status = 'done'
        if (task.total) task.loaded = task.total
        // 成功态短暂展示后自动消失；失败态保留到用户手动关闭
        setTimeout(() => this.remove(task.key), 3000)
      } catch (e) {
        // 主动取消：静默移除任务，不记为失败
        if (e?.name === 'AbortError') {
          this.remove(task.key)
          return
        }
        task.status = 'error'
        task.error = e?.message || '下载失败，请稍后重试'
      } finally {
        controllers.delete(task.key)
      }
    },

    /** 取消进行中的任务（中止请求并移除） */
    cancel(key) {
      controllers.get(key)?.abort()
    },

    remove(key) {
      // 手动关闭进行中任务时也中断请求，避免后台继续传
      controllers.get(key)?.abort()
      controllers.delete(key)
      const i = this.tasks.findIndex((t) => t.key === key)
      if (i !== -1) this.tasks.splice(i, 1)
    },

    /** 清除所有非进行中的任务（已完成 / 已失败） */
    clearFinished() {
      this.tasks
        .filter((t) => t.status !== 'downloading')
        .forEach((t) => this.remove(t.key))
    }
  }
})

/** 任务展示名：picName + 实际格式，与最终下载文件名保持一致 */
function buildTaskName(picture) {
  const name = picture?.picName || '图片'
  const ext = picture?.picFormat ? String(picture.picFormat).toLowerCase() : ''
  return ext && !name.toLowerCase().endsWith(`.${ext}`) ? `${name}.${ext}` : name
}
