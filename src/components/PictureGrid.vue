<template>
  <div
    class="grid"
    :class="{ 'is-fixed': columns > 0 }"
    :style="{ '--cols': columns, gap: `${gap}px` }"
  >
    <div
      v-for="item in items"
      :key="itemKey ? item[itemKey] : item.id"
      class="grid-item"
    >
      <slot :item="item" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  gap: { type: Number, default: 18 },
  itemKey: { type: String, default: 'id' },
  /**
   * 固定列数。传 0（默认）时按卡片最小宽度自适应排布；
   * 传具体数字则锁定列数，窄屏由媒体查询逐级降级，避免挤压成细条。
   */
  columns: { type: Number, default: 0 }
})
</script>

<style scoped lang="less">
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  align-items: start;
}

.grid.is-fixed {
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
}

.grid-item {
  min-width: 0;
}

/* 固定列数时的响应式降级：宽屏锁定指定列数，窄屏依次降到 3 / 2 列 */
@media (max-width: 1080px) {
  .grid.is-fixed {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .grid.is-fixed {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  }

  .grid.is-fixed {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
