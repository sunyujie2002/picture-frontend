<template>
  <div v-if="downloadStore.tasks.length" class="dl-panel">
    <div class="dl-head">
      <span class="dl-head-title">下载管理</span>
      <span class="dl-head-clear" @click="downloadStore.clearFinished()">清除已完成</span>
    </div>

    <div v-for="t in downloadStore.tasks" :key="t.key" class="dl-task" :class="t.status">
      <span class="dl-icon" :class="t.status">
        <svg
          v-if="t.status === 'downloading'"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3v11" />
          <path d="M7 9.5l5 5 5-5" />
          <path d="M4 20h16" />
        </svg>
        <svg
          v-else-if="t.status === 'done'"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v6" />
          <path d="M12 16.8v.4" />
        </svg>
      </span>

      <div class="dl-body">
        <div class="dl-line">
          <span class="dl-name" :title="t.name">{{ t.name }}</span>
          <span class="dl-pct">{{ statusText(t) }}</span>
        </div>
        <div class="dl-bar">
          <div
            class="dl-fill"
            :class="{ flow: t.status === 'downloading' && !t.total }"
            :style="fillStyle(t)"
          />
        </div>
        <div class="dl-sub">
          <span v-if="t.status === 'downloading'">{{ sizeText(t) }}</span>
          <span v-else-if="t.status === 'done'">已保存，可在浏览器下载目录查看</span>
          <span v-else class="dl-err">{{ t.error }}</span>
        </div>
      </div>

      <button
        class="dl-btn"
        :title="t.status === 'downloading' ? '取消下载' : '关闭'"
        @click="t.status === 'downloading' ? downloadStore.cancel(t.key) : downloadStore.remove(t.key)"
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useDownloadStore } from '@/stores/download'
import { formatSize } from '@/utils/format'

const downloadStore = useDownloadStore()

/** 右侧百分比 / 状态文字 */
function statusText(t) {
  if (t.status === 'done') return '已完成'
  if (t.status === 'error') return '下载失败'
  return t.total ? `${Math.floor((t.loaded / t.total) * 100)}%` : '下载中'
}

/** 进度条下方：已接收 / 总大小（无 Content-Length 时只显示已接收） */
function sizeText(t) {
  if (!t.total) return `已接收 ${formatSize(t.loaded)}`
  return `${formatSize(t.loaded)} / ${formatSize(t.total)}`
}

/** 进度条宽度：已知总量按百分比，未知总量交给 .flow 滚动动画 */
function fillStyle(t) {
  if (t.status === 'done') return { width: '100%' }
  if (!t.total) return {}
  return { width: `${Math.min(100, (t.loaded / t.total) * 100)}%` }
}
</script>

<style scoped lang="less">
.dl-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1000;
  width: 328px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dl-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.dl-head-clear {
  cursor: pointer;
  transition: color 0.15s ease;
}

.dl-head-clear:hover {
  color: var(--text);
}

.dl-task {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  animation: dl-in 0.18s ease;
}

@keyframes dl-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.dl-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--surface-2);
  color: var(--text-tertiary);
}

.dl-icon.downloading {
  background: var(--brand-soft);
  color: var(--brand);
}

.dl-icon.done {
  color: var(--success);
}

.dl-icon.error {
  color: var(--danger);
}

.dl-body {
  flex: 1;
  min-width: 0;
}

.dl-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.dl-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  max-width: 218px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dl-pct {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.dl-task.error .dl-pct {
  color: var(--danger);
}

.dl-bar {
  height: 4px;
  margin: 8px 0 6px;
  border-radius: 4px;
  background: var(--surface-2);
  overflow: hidden;
}

.dl-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--brand);
  transition: width 0.15s linear;
}

/* 未知总大小（无 Content-Length）时的滚动动画 */
.dl-fill.flow {
  width: 35%;
  animation: dl-flow 1.1s ease-in-out infinite;
}

@keyframes dl-flow {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(286%);
  }
}

.dl-task.done .dl-fill {
  background: var(--success);
}

.dl-task.error .dl-fill {
  background: var(--danger);
}

.dl-sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.dl-err {
  color: var(--danger);
}

.dl-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.dl-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

@media (max-width: 480px) {
  .dl-panel {
    right: 12px;
    left: 12px;
    bottom: 12px;
    width: auto;
  }
}
</style>
