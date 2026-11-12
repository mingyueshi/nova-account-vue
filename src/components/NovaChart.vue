<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { init, use, type EChartsType } from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { NovaChartOption } from '../chart-options'

use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AriaComponent,
  SVGRenderer,
])
const props = withDefaults(
  defineProps<{
    option: NovaChartOption
    label: string
    description?: string
    height?: number
    active?: boolean
    /** Re-read CSS tokens when a host changes its own theme without data attributes. */
    colorTokens?: string[]
    themeKey?: string
    errorLabel?: string
  }>(),
  {
    height: 320,
    active: true,
    description: '',
    themeKey: '',
    errorLabel: 'Chart unavailable. View the data table.',
  },
)
const emit = defineEmits<{ ready: []; error: [message: string] }>()
const root = ref<HTMLElement>()
const surface = ref<HTMLElement>()
const error = ref('')
let chart: EChartsType | undefined
let resize: ResizeObserver | undefined
let theme: MutationObserver | undefined
let reduced: MediaQueryList | undefined
let frame = 0
let mounted = false
function draw() {
  if (!mounted || !props.active || !surface.value?.clientWidth || !surface.value.clientHeight)
    return
  try {
    if (!chart) {
      chart = init(surface.value, undefined, { renderer: 'svg' })
      emit('ready')
    }
    const css = getComputedStyle(root.value!)
    const read = (key: string, fallback: string) => css.getPropertyValue(key).trim() || fallback
    const ink = read('--na-ink', '#23283a')
    const muted = read('--na-muted', '#667389')
    const line = read('--na-line', '#e7eaf2')
    const option: NovaChartOption = {
      color: props.colorTokens?.map((token) => read(token, token)) ?? [
        read('--na-brand', '#1d4ed8'),
        read('--na-chart-success', '#208660'),
        read('--na-chart-info', '#477ecd'),
        read('--na-chart-warm', '#b97455'),
      ],
      textStyle: { color: ink, fontFamily: 'system-ui, sans-serif', fontSize: 12 },
      backgroundColor: 'transparent',
      ...props.option,
      animation: !reduced?.matches && props.option.animation !== false,
      animationDuration: 200,
      animationDurationUpdate: 240,
    }
    if (option.xAxis)
      option.xAxis = (Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis]).map((axis) => ({
        axisLabel: { color: muted, hideOverlap: true },
        axisLine: { lineStyle: { color: line } },
        ...axis,
      }))
    if (option.yAxis)
      option.yAxis = (Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis]).map((axis) => ({
        axisLabel: { color: muted },
        splitLine: { lineStyle: { color: line, type: 'dashed' } },
        ...axis,
      }))
    if (option.legend)
      option.legend = (Array.isArray(option.legend) ? option.legend : [option.legend]).map(
        (legend) => ({ textStyle: { color: ink }, ...legend }),
      )
    // Rich text tooltips avoid HTML interpolation and stay inside the chart surface.
    if (option.tooltip)
      option.tooltip = {
        ...(Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip),
        renderMode: 'richText',
        confine: true,
        backgroundColor: read('--na-surface', '#fff'),
        borderColor: line,
        textStyle: { color: ink },
      }
    chart.setOption(option, { replaceMerge: ['series', 'xAxis', 'yAxis'], lazyUpdate: false })
    chart.resize()
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
    emit('error', error.value)
  }
}
function schedule() {
  if (!mounted) return
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(draw)
}
watch(
  () => [props.option, props.active, props.height, props.themeKey, props.colorTokens],
  schedule,
  {
    deep: true,
    flush: 'post',
  },
)
onMounted(() => {
  mounted = true
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  reduced?.addEventListener('change', schedule)
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(schedule)
    resize.observe(surface.value!)
  }
  window.addEventListener('resize', schedule)
  const parent = root.value?.closest('.nova-account')
  if (parent && typeof MutationObserver !== 'undefined') {
    theme = new MutationObserver(schedule)
    theme.observe(parent, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent', 'style', 'class'],
    })
  }
  schedule()
})
onBeforeUnmount(() => {
  mounted = false
  cancelAnimationFrame(frame)
  resize?.disconnect()
  theme?.disconnect()
  reduced?.removeEventListener('change', schedule)
  window.removeEventListener('resize', schedule)
  chart?.dispose()
})
</script>
<template>
  <figure
    ref="root"
    class="nova-chart"
    role="img"
    :aria-label="description ? `${label}。${description}` : label"
    style="margin: 0; min-width: 0; width: 100%"
  >
    <div
      ref="surface"
      aria-hidden="true"
      :style="{ height: `${height}px`, width: '100%', minWidth: 0 }"
    />
    <figcaption v-if="error" role="alert">{{ errorLabel }}</figcaption>
  </figure>
</template>
