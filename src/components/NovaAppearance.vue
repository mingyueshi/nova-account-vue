<script setup lang="ts">
import type { Accent, Appearance, ThemeMode } from '../types'
import NovaButton from './NovaButton.vue'
const props = defineProps<{ modelValue: Appearance; storageError?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Appearance] }>()
const modes: { id: ThemeMode; label: string; icon: string }[] = [{ id: 'light', label: '浅色', icon: '☀' }, { id: 'dark', label: '深色', icon: '☾' }, { id: 'system', label: '跟随系统', icon: '◐' }]
const accents: { id: Accent; label: string; color: string }[] = [{ id: 'iris', label: '鸢尾紫', color: '#6958c5' }, { id: 'blue', label: '晴空蓝', color: '#346bbd' }, { id: 'teal', label: '湖水绿', color: '#217560' }, { id: 'amber', label: '暖琥珀', color: '#956100' }]
function update(value: Partial<Appearance>) { emit('update:modelValue', { ...props.modelValue, ...value }) }
</script>
<template>
  <section class="na:grid na:gap-7" aria-label="外观设置">
    <div><h3 class="na:mb-3 na:text-sm na:font-semibold">显示模式</h3>
      <div class="na:grid na:grid-cols-3 na:gap-2">
        <button v-for="mode in modes" :key="mode.id" type="button" :aria-pressed="modelValue.mode === mode.id" class="na:rounded-xl na:border na:border-[var(--na-line)] na:p-4 na:text-left na:hover:bg-[var(--na-soft)]" :class="modelValue.mode === mode.id ? 'na:bg-[var(--na-soft)] na:text-[var(--na-brand)]' : 'na:bg-[var(--na-surface)]'" @click="update({ mode: mode.id })">
          <span class="na:mb-3 na:block na:text-2xl" aria-hidden="true">{{ mode.icon }}</span><span class="na:text-xs na:font-medium">{{ mode.label }} {{ modelValue.mode === mode.id ? '✓' : '' }}</span>
        </button>
      </div>
    </div>
    <div><h3 class="na:mb-3 na:text-sm na:font-semibold">品牌色</h3>
      <div class="na:grid na:grid-cols-2 na:gap-2 na:sm:grid-cols-4">
        <button v-for="accent in accents" :key="accent.id" type="button" :aria-pressed="modelValue.accent === accent.id" class="na:flex na:min-h-12 na:items-center na:gap-2 na:rounded-xl na:border na:border-[var(--na-line)] na:bg-[var(--na-surface)] na:px-3 na:py-3 na:text-xs" :class="modelValue.accent === accent.id ? 'na:text-[var(--na-brand)]' : ''" @click="update({ accent: accent.id })"><span class="na:size-3 na:shrink-0 na:rounded-full" :style="{ background: accent.color }" aria-hidden="true" />{{ accent.label }} {{ modelValue.accent === accent.id ? '✓' : '' }}</button>
      </div>
    </div>
    <div class="na:rounded-xl na:border na:border-[var(--na-line)] na:bg-[var(--na-soft)] na:p-5"><p class="na:mb-1 na:font-medium">让账户空间，更像你</p><p class="na:text-sm na:text-[var(--na-muted)]">色彩与模式即时生效，内容和布局保持清晰。</p><NovaButton variant="primary" class="na:mt-4" tabindex="-1">按钮预览</NovaButton></div>
    <div class="na:flex na:flex-wrap na:items-center na:justify-between na:gap-3"><p class="na:text-xs na:text-[var(--na-muted)]">{{ storageError || '仅外观偏好可选择保存在此浏览器。' }}</p><NovaButton variant="ghost" @click="update({ mode: 'light', accent: 'iris' })">恢复默认</NovaButton></div>
  </section>
</template>
