<template>
  <a-popover trigger="click" placement="bottomLeft" :overlay-class-name="'color-popover'">
    <template #content>
      <div class="color-panel">
        <div class="panel-title">选择主色调</div>
        <div class="native-row">
          <input type="color" :value="nativeValue" @input="onNative" class="native-input" />
          <span class="native-hex">{{ modelValue || '未选择' }}</span>
          <a-button v-if="modelValue" type="link" size="small" @click="clear">清除</a-button>
        </div>
        <div class="preset-title">常用色</div>
        <div class="preset-grid">
          <button
            v-for="c in presets"
            :key="c"
            class="preset"
            :class="{ active: normalizeColor(modelValue) === c }"
            :style="{ background: c }"
            :title="c"
            @click="pick(c)"
          />
        </div>
      </div>
    </template>

    <button type="button" class="trigger" :class="{ 'has-value': !!modelValue }">
      <span class="swatch" :style="{ background: modelValue ? normalizeColor(modelValue) : 'transparent' }">
        <span v-if="!modelValue" class="swatch-empty" />
      </span>
      <span class="label">{{ modelValue ? normalizeColor(modelValue) : '主色调' }}</span>
    </button>
  </a-popover>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeColor } from '@/utils/format'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'change'])

const presets = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#64748b',
  '#1f2430',
  '#ffffff'
]

const nativeValue = computed(() => normalizeColor(props.modelValue) || '#4f46e5')

function pick(color) {
  emit('update:modelValue', color)
  emit('change', color)
}

function onNative(e) {
  const value = e.target.value
  emit('update:modelValue', value)
  emit('change', value)
}

function clear() {
  emit('update:modelValue', '')
  emit('change', '')
}
</script>

<style scoped lang="less">
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  color: var(--text);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.trigger:hover {
  border-color: var(--brand);
}

.trigger.has-value {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.swatch-empty {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c9cdd8;
}

.label {
  font-size: 13px;
  color: var(--text-secondary);
}

.color-panel {
  width: 232px;
}

.panel-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.native-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.native-input {
  width: 40px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.native-hex {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: ui-monospace, monospace;
}

.preset-title {
  margin: 14px 0 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.preset {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 7px;
  cursor: pointer;
  padding: 0;
  transition: transform 0.14s ease;
}

.preset:hover {
  transform: scale(1.12);
}

.preset.active {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
