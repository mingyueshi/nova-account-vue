<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  ChartLine,
  ChartColumn,
  CircleHelp,
  StepForward,
} from '@lucide/vue'
import { NovaButton, NovaIcon, NovaTheme } from '../src'
import type { Appearance } from '../src'
import { NovaChart, type NovaChartOption } from '../src/charts'
import {
  chartCsv,
  chartSeries,
  createActivityRows,
  type ChartSample,
  type ChartScene,
} from './charts/data'
import './charts/charts.css'
const props = defineProps<{ appearance: Appearance; active: boolean }>()
const days = ref(7)
const scene = ref<ChartScene>('activity')
const sample = ref<ChartSample>('normal')
const kind = ref<'line' | 'bar'>('line')
const step = ref(0)
const playing = ref(false)
const hiddenSeries = ref<string[]>([])
const note = ref('')
let timer: ReturnType<typeof setInterval> | undefined
const rows = computed(() => createActivityRows(days.value, step.value, sample.value))
const series = computed(() => chartSeries(scene.value))
const totals = computed(() =>
  series.value.map((item) => ({
    ...item,
    total: rows.value.reduce((sum, row) => sum + row[item.key], 0),
  })),
)
const chartVisible = computed(() =>
  series.value.some((item) => !hiddenSeries.value.includes(item.key)),
)
const complete = computed(() => rows.value.reduce((sum, row) => sum + row.completed, 0))
const created = computed(() => rows.value.reduce((sum, row) => sum + row.created, 0))
const paid = computed(() => rows.value.reduce((sum, row) => sum + row.paid, 0))
const refunded = computed(() => rows.value.reduce((sum, row) => sum + row.refunded, 0))
const breakdown = computed(() =>
  scene.value === 'activity'
    ? [
        { name: '已完成', value: complete.value },
        { name: '待处理', value: created.value - complete.value },
      ]
    : [
        { name: '有效订单', value: paid.value - refunded.value },
        { name: '退款订单', value: refunded.value },
      ],
)
const sum = computed(() => breakdown.value.reduce((value, item) => value + item.value, 0))
const rate = computed(() =>
  sum.value ? Math.round((breakdown.value[0]!.value / sum.value) * 100) : 0,
)
const trendOption = computed<NovaChartOption>(() => ({
  grid: { left: 48, right: 20, top: 24, bottom: 70 },
  tooltip: { trigger: 'axis' },
  legend: {
    show: false,
    selected: Object.fromEntries(
      series.value.map((item) => [item.name, !hiddenSeries.value.includes(item.key)]),
    ),
  },
  xAxis: {
    type: 'category',
    data: rows.value.map((row) => row.date.slice(5).replace('-', '/')),
    boundaryGap: kind.value === 'bar',
  },
  yAxis: { type: 'value', minInterval: 1, name: scene.value === 'activity' ? '项' : '单' },
  dataZoom: [
    { type: 'inside' },
    { type: 'slider', height: 16, bottom: 8, borderColor: 'transparent', showDetail: false },
  ],
  series: series.value.map((item, index) => ({
    id: item.key,
    name: item.name,
    type: kind.value,
    data: rows.value.map((row) => row[item.key]),
    smooth: false,
    symbolSize: 6,
    showSymbol: days.value === 7,
    lineStyle: { width: 2, type: index === 1 ? 'dashed' : 'solid' },
    barMaxWidth: 24,
    areaStyle: kind.value === 'line' ? { opacity: 0.06 } : undefined,
  })),
}))
const breakdownOption = computed<NovaChartOption>(() => ({
  tooltip: { trigger: 'item' },
  series: [
    {
      id: 'composition',
      type: 'pie',
      radius: ['60%', '78%'],
      center: ['50%', '50%'],
      label: { show: false },
      labelLine: { show: false },
      data: breakdown.value,
      itemStyle: { borderRadius: 3 },
      emptyCircleStyle: { color: 'transparent' },
    },
  ],
}))
function stop() {
  playing.value = false
  clearInterval(timer)
  timer = undefined
}
function advance() {
  step.value++
  note.value = `已推进到 ${rows.value.at(-1)?.date ?? '下一天'}。`
}
function togglePlayback() {
  if (playing.value) return stop()
  if (sample.value !== 'normal' || !props.active) return
  playing.value = true
  note.value = '正在回放模拟记录，每 1.8 秒推进一天。'
  timer = setInterval(advance, 1800)
}
function reset() {
  stop()
  step.value = 0
  hiddenSeries.value = []
  note.value = '已回到初始数据。'
}
function restoreSeries() {
  hiddenSeries.value = []
}
function toggleSeries(key: string) {
  hiddenSeries.value = hiddenSeries.value.includes(key)
    ? hiddenSeries.value.filter((item) => item !== key)
    : [...hiddenSeries.value, key]
}
function exportCsv() {
  const url = URL.createObjectURL(
    new Blob([chartCsv(rows.value, scene.value)], { type: 'text/csv;charset=utf-8' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `nova-${scene.value}-${days.value}days.csv`
  a.click()
  URL.revokeObjectURL(url)
  note.value = `已导出当前 ${rows.value.length} 天的明细。`
}
function onVisibility() {
  if (document.hidden) stop()
}
watch(
  () => props.active,
  (active) => {
    if (!active) stop()
  },
)
watch([scene, sample, days], () => {
  stop()
  hiddenSeries.value = []
  note.value = ''
})
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>
<template>
  <NovaTheme :model-value="appearance" class="demo-analytics" :data-chart-scene="scene">
    <div class="demo-chart-toolbar">
      <div class="demo-filter-tabs" role="group" aria-label="图表业务场景">
        <button type="button" :aria-pressed="scene === 'activity'" @click="scene = 'activity'">
          <NovaIcon name="tasks" :size="16" />任务进展
        </button>
        <button type="button" :aria-pressed="scene === 'orders'" @click="scene = 'orders'">
          <NovaIcon name="orders" :size="16" />订单变化
        </button>
      </div>
      <div class="demo-chart-filters">
        <label
          >时间范围<select v-model.number="days" aria-label="图表时间范围">
            <option :value="7">最近 7 天</option>
            <option :value="30">最近 30 天</option>
          </select></label
        >
        <label
          >数据状态<select v-model="sample" aria-label="图表数据状态">
            <option value="normal">示例数据</option>
            <option value="zero">全零数据</option>
            <option value="empty">暂无数据</option>
          </select></label
        >
        <NovaButton :disabled="!rows.length" @click="exportCsv"
          ><NovaIcon :icon="Download" :size="16" />导出 CSV</NovaButton
        >
      </div>
    </div>
    <div class="demo-analytics-workspace">
      <section class="demo-panel demo-chart-main" aria-label="趋势分析">
        <div class="demo-panel-heading">
          <div>
            <h2>{{ scene === 'activity' ? '任务处理趋势' : '订单数量趋势' }}</h2>
            <p>
              {{ rows.length ? `${rows[0]!.date} — ${rows.at(-1)!.date}` : '当前范围内暂无记录' }} ·
              合成数据
            </p>
          </div>
          <div class="demo-chart-kind" role="group" aria-label="图表类型">
            <button type="button" :aria-pressed="kind === 'line'" @click="kind = 'line'">
              <NovaIcon :icon="ChartLine" :size="16" />折线</button
            ><button type="button" :aria-pressed="kind === 'bar'" @click="kind = 'bar'">
              <NovaIcon :icon="ChartColumn" :size="16" />柱状
            </button>
          </div>
        </div>
        <div class="demo-chart-series" role="group" aria-label="显示数据系列">
          <button
            v-for="(item, index) in totals"
            :key="item.key"
            type="button"
            :aria-pressed="!hiddenSeries.includes(item.key)"
            @click="toggleSeries(item.key)"
          >
            <span :data-series-color="index" aria-hidden="true" />{{ item.name
            }}<strong>{{ item.total }}</strong
            ><small>{{ scene === 'activity' ? '项' : '单' }}</small>
          </button>
        </div>
        <NovaChart
          v-if="rows.length && chartVisible"
          :color-tokens="
            scene === 'activity'
              ? ['--na-brand', '--na-chart-success']
              : ['--na-brand', '--na-chart-warm']
          "
          :option="trendOption"
          :height="360"
          :active="active"
          :label="scene === 'activity' ? '任务处理趋势图' : '订单数量趋势图'"
          description="可切换时间、类型与数据系列；完整数值见下方数据明细。"
        />
        <div v-else class="demo-chart-empty">
          <NovaIcon name="charts" :size="32" />
          <h3>{{ rows.length ? '尚未选择数据系列' : '当前范围内没有数据' }}</h3>
          <p>
            {{
              rows.length
                ? '选择上方任一系列，或恢复全部系列。'
                : '可切换数据状态，体验有记录时的图表。'
            }}
          </p>
          <NovaButton v-if="rows.length" @click="restoreSeries">显示全部系列</NovaButton
          ><NovaButton v-else @click="sample = 'normal'">查看示例数据</NovaButton>
        </div>
        <div class="demo-chart-playback">
          <div class="demo-scene-row">
            <NovaButton
              :disabled="sample !== 'normal'"
              :variant="playing ? 'primary' : 'secondary'"
              :aria-pressed="playing"
              @click="togglePlayback"
              ><NovaIcon :icon="playing ? Pause : Play" :size="16" />{{
                playing ? '暂停回放' : '开始回放'
              }}</NovaButton
            ><NovaButton
              :disabled="sample !== 'normal' || playing"
              aria-label="推进一天"
              @click="advance"
              ><NovaIcon :icon="StepForward" :size="16" /><span>推进一天</span></NovaButton
            ><NovaButton variant="ghost" @click="reset"
              ><NovaIcon :icon="RotateCcw" :size="16" />重置</NovaButton
            >
          </div>
          <p>每次推进一天 · 离开页面自动暂停</p>
        </div>
      </section>
      <aside class="demo-panel demo-chart-breakdown" aria-label="期间汇总">
        <div class="demo-panel-heading">
          <div>
            <h2>{{ scene === 'activity' ? '期间任务汇总' : '期间订单汇总' }}</h2>
            <p>与左侧使用同一组明细记录。</p>
          </div>
        </div>
        <div v-if="sum" class="demo-chart-ring">
          <NovaChart
            :color-tokens="
              scene === 'activity'
                ? ['--na-chart-success', '--na-brand']
                : ['--na-brand', '--na-chart-warm']
            "
            :option="breakdownOption"
            :height="224"
            :active="active"
            label="期间构成图"
            :description="breakdown.map((item) => `${item.name} ${item.value}`).join('，')"
          />
          <div aria-hidden="true">
            <strong>{{ rate }}<small>%</small></strong
            ><span>{{ scene === 'activity' ? '完成率' : '有效订单占比' }}</span>
          </div>
        </div>
        <div v-else class="demo-chart-ring-empty">
          <span>—</span>
          <p>{{ rows.length ? '当前数值均为 0' : '暂无汇总数据' }}</p>
        </div>
        <dl class="demo-chart-summary">
          <div v-for="(item, index) in breakdown" :key="item.name">
            <dt>
              <span
                :data-series-color="scene === 'activity' ? 1 - index : index"
                aria-hidden="true"
              />{{ item.name }}
            </dt>
            <dd>
              {{ item.value }} <small>{{ scene === 'activity' ? '项' : '单' }}</small>
            </dd>
          </div>
          <div>
            <dt>{{ scene === 'activity' ? '新增任务合计' : '支付订单合计' }}</dt>
            <dd>{{ sum }}</dd>
          </div>
        </dl>
        <p class="demo-chart-hint">
          <NovaIcon :icon="CircleHelp" :size="16" />{{
            scene === 'activity'
              ? '待处理 = 新增 − 完成。本例按期间内同一批任务统计。'
              : '退款计入支付订单；有效订单 = 支付 − 退款。'
          }}
        </p>
      </aside>
    </div>
    <p role="status" class="demo-chart-status">
      {{ note || '图表支持悬停提示、图例筛选和底部范围缩放。回放仅更新本页模拟数据。' }}
    </p>
    <details class="demo-panel demo-chart-data">
      <summary>
        <NovaIcon name="document" :size="16" />数据明细
        <span>{{ rows.length }} 条 · 与图表、导出同步</span>
      </summary>
      <div class="demo-chart-table-scroll">
        <table>
          <caption>
            当前图表明细（合成数据）
          </caption>
          <thead>
            <tr>
              <th scope="col">日期</th>
              <th v-for="item in series" :key="item.key" scope="col">{{ item.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.date">
              <th scope="row">{{ row.date }}</th>
              <td v-for="item in series" :key="item.key">{{ row[item.key] }}</td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="3">当前范围内暂无记录。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <details class="demo-usage">
      <summary>NovaChart · 图表接入与主题</summary>
      <div class="demo-usage-body">
        <pre><code>import { NovaChart } from 'nova-account/charts'

&lt;NovaChart :option="option" label="任务处理趋势"
  :active="page === 'custom:charts'" :height="360" /&gt;</code></pre>
        <p>
          与后台图表实验室一致使用 Apache ECharts 6.1.0；按需载入折线、柱状、环形与 SVG 渲染器。读取
          Nova 主题令牌，响应容器尺寸变化，并尊重减少动态效果设置。
        </p>
        <p>图表通过独立入口接入，基础账户入口不加载图表引擎。表格作为可读数值明细保留。</p>
      </div>
    </details>
  </NovaTheme>
</template>
