<script setup lang="ts">
import { computed } from 'vue'
import { NovaButton, NovaIcon } from '../src'
import { NovaChart, type NovaChartOption } from '../src/charts'
import type { AccountSnapshot } from '../src'
const props = defineProps<{ snapshot: AccountSnapshot }>()
defineEmits<{ explore: [] }>()
const days = computed(() => {
  if (!props.snapshot.activity.length) return []
  const latest = Math.max(...props.snapshot.activity.map((item) => Date.parse(item.at)), 0)
  const end = new Date(latest).toISOString().slice(0, 10)
  return Array.from({ length: 7 }, (_, index) =>
    new Date(Date.parse(end + 'T00:00:00Z') - (6 - index) * 86400000).toISOString().slice(0, 10),
  )
})
const count = computed(() =>
  days.value.map(
    (day) => props.snapshot.activity.filter((item) => item.at.slice(0, 10) === day).length,
  ),
)
const total = computed(() => count.value.reduce((a, b) => a + b, 0))
const option = computed<NovaChartOption>(() => ({
  grid: { left: 36, right: 12, top: 20, bottom: 32 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: days.value.map((day) => day.slice(5).replace('-', '/')) },
  yAxis: { type: 'value', minInterval: 1 },
  series: [
    {
      id: 'account-events',
      name: '账户活动',
      type: 'bar',
      barMaxWidth: 28,
      data: count.value,
      itemStyle: { borderRadius: [3, 3, 0, 0] },
    },
  ],
}))
</script>
<template>
  <section class="demo-panel demo-overview-chart" aria-label="账户活动统计">
    <div class="demo-panel-heading">
      <div>
        <h2>账户活动</h2>
        <p>最近记录所在的 7 天 · 共 {{ total }} 次</p>
      </div>
      <NovaButton variant="ghost" @click="$emit('explore')"
        >查看数据演示<NovaIcon name="chevron" :size="16"
      /></NovaButton>
    </div>
    <NovaChart
      v-if="days.length"
      :option="option"
      :height="260"
      label="最近七天账户活动柱状图"
      :description="days.map((day, index) => `${day}：${count[index]}次`).join('，')"
    />
    <p v-else class="demo-scene-meta">暂无账户活动记录。</p>
    <p class="demo-scene-meta">按 UTC 日期汇总当前账户记录；记录为空的日期显示为 0。</p>
  </section>
</template>
