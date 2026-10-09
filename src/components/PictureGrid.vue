<template>
  <div class="grid" :style="{ gap: `${gap}px` }">
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
  itemKey: { type: String, default: 'id' }
})
</script>

<style scoped lang="less">
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  align-items: start;
}

.grid-item {
  min-width: 0;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  }
}
</style>
