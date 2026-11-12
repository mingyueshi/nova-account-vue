<script setup lang="ts">
defineProps<{ components: string[]; steps?: string[] }>()
defineEmits<{ component: [name: string] }>()
</script>
<template>
  <details class="demo-usage">
    <summary>交互说明与组件用法</summary>
    <div class="demo-usage-body">
      <ol v-if="steps?.length">
        <li v-for="step in steps" :key="step">{{ step }}</li>
      </ol>
      <div class="demo-usage-links">
        <span>使用组件</span
        ><button
          v-for="name in components"
          :key="name"
          type="button"
          @click="$emit('component', name)"
        >
          {{ name }} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <p>演示数据仅保存在本页内存，刷新后重置。</p>
    </div>
  </details>
</template>
