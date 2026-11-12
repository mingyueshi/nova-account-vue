<script setup lang="ts">
import { computed, markRaw, nextTick, ref, type Component } from 'vue'
import {
  Camera,
  Heart,
  Star,
  Globe,
  Link,
  Download,
  Image,
  Folder,
  Users,
  LockKeyhole,
  KeyRound,
  CircleHelp,
  CircleAlert,
  CircleCheck,
  RefreshCw,
  Eye,
  Menu,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
} from '@lucide/vue'
import { NovaButton, NovaField, NovaIcon, NovaTheme } from '../src'
import type { Appearance } from '../src'
import { resolveNovaIcon } from '../src/icons'

defineProps<{ appearance: Appearance }>()
interface IconItem {
  name: string
  alias?: string
  label: string
  category: string
  component: Component
}
const groups = ['全部', '账户与安全', '编辑与内容', '操作与反馈', '设备与布局']
const catalog: IconItem[] = [
  ...(
    [
      ['profile', 'UserRound', '用户', '账户与安全'],
      ['security', 'ShieldCheck', '安全', '账户与安全'],
      ['notifications', 'Bell', '通知', '账户与安全'],
      ['messages', 'Mail', '消息', '账户与安全'],
      ['logout', 'LogOut', '退出', '账户与安全'],
      ['tasks', 'SquareCheckBig', '任务', '编辑与内容'],
      ['editor', 'FilePenLine', '编辑', '编辑与内容'],
      ['comments', 'MessagesSquare', '评论', '编辑与内容'],
      ['document', 'FileText', '文档', '编辑与内容'],
      ['fields', 'TextCursorInput', '输入', '编辑与内容'],
      ['calendar', 'CalendarDays', '日期', '编辑与内容'],
      ['code', 'CodeXml', '代码', '编辑与内容'],
      ['search', 'Search', '搜索', '操作与反馈'],
      ['plus', 'Plus', '添加', '操作与反馈'],
      ['trash', 'Trash2', '删除', '操作与反馈'],
      ['undo', 'Undo2', '撤销', '操作与反馈'],
      ['check', 'Check', '完成', '操作与反馈'],
      ['copy', 'Copy', '复制', '操作与反馈'],
      ['save', 'Save', '保存', '操作与反馈'],
      ['like', 'ThumbsUp', '点赞', '操作与反馈'],
      ['upload', 'Upload', '上传', '操作与反馈'],
      ['chevron', 'ChevronRight', '展开', '操作与反馈'],
      ['overview', 'LayoutDashboard', '概览', '设备与布局'],
      ['devices', 'Monitor', '电脑', '设备与布局'],
      ['phone', 'Smartphone', '手机', '设备与布局'],
      ['dialogs', 'PanelsTopLeft', '弹窗', '设备与布局'],
      ['appearance', 'Palette', '外观', '设备与布局'],
      ['sun', 'Sun', '浅色', '设备与布局'],
      ['moon', 'Moon', '深色', '设备与布局'],
      ['system', 'MonitorCog', '系统', '设备与布局'],
      ['settings', 'Settings2', '设置', '设备与布局'],
      ['buttons', 'MousePointer2', '操作', '设备与布局'],
      ['icons', 'Shapes', '图标', '设备与布局'],
      ['orders', 'Package', '订单', '编辑与内容'],
      ['clock', 'Clock', '时间', '操作与反馈'],
    ] as const
  ).map(([alias, name, label, category]) => ({
    name,
    alias,
    label,
    category,
    component: markRaw(resolveNovaIcon(alias)!),
  })),
  ...(
    [
      ['Camera', '相机', '编辑与内容', Camera],
      ['Heart', '喜欢', '操作与反馈', Heart],
      ['Star', '收藏', '操作与反馈', Star],
      ['Globe', '网站', '设备与布局', Globe],
      ['Link', '链接', '编辑与内容', Link],
      ['Download', '下载', '操作与反馈', Download],
      ['Image', '图片', '编辑与内容', Image],
      ['Folder', '文件夹', '编辑与内容', Folder],
      ['Users', '团队', '账户与安全', Users],
      ['LockKeyhole', '密码', '账户与安全', LockKeyhole],
      ['KeyRound', '密钥', '账户与安全', KeyRound],
      ['CircleHelp', '帮助', '操作与反馈', CircleHelp],
      ['CircleAlert', '提示', '操作与反馈', CircleAlert],
      ['CircleCheck', '成功', '操作与反馈', CircleCheck],
      ['RefreshCw', '刷新', '操作与反馈', RefreshCw],
      ['Eye', '查看', '操作与反馈', Eye],
      ['Menu', '菜单', '设备与布局', Menu],
      ['ExternalLink', '外链', '操作与反馈', ExternalLink],
      ['ArrowRight', '向右', '操作与反馈', ArrowRight],
      ['ArrowLeft', '向左', '操作与反馈', ArrowLeft],
    ] as [string, string, string, Component][]
  ).map(([name, label, category, component]) => ({
    name,
    label,
    category,
    component: markRaw(component),
  })),
]
const query = ref('')
const category = ref('全部')
const selected = ref('UserRound')
const current = computed(() => catalog.find((item) => item.name === selected.value) ?? catalog[0]!)
const visible = computed(() =>
  catalog.filter(
    (item) =>
      (category.value === '全部' || item.category === category.value) &&
      `${item.name} ${item.alias ?? ''} ${item.label}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
)
const size = ref(32)
const stroke = ref(2)
const color = ref('var(--na-brand)')
const source = ref<'nova' | 'lucide'>('nova')
const live = ref<HTMLElement>()
const browser = ref<HTMLElement>()
function returnToCatalog() {
  browser.value?.scrollIntoView?.({ block: 'start' })
  browser.value
    ?.querySelector<HTMLInputElement>('input[type="search"]')
    ?.focus({ preventScroll: true })
}
const copyNote = ref('')
const code = computed(() =>
  source.value === 'lucide'
    ? `import { ${current.value.name} } from '@lucide/vue'\n\n<${current.value.name} :size="${size.value}" :stroke-width="${stroke.value}" color="${color.value}" />`
    : current.value.alias
      ? `import { NovaIcon } from 'nova-account'\n\n<NovaIcon name="${current.value.alias}" :size="${size.value}"\n  :stroke-width="${stroke.value}" color="${color.value}" />`
      : `import { ${current.value.name} } from '@lucide/vue'\nimport { NovaIcon } from 'nova-account'\n\n<NovaIcon :icon="${current.value.name}" :size="${size.value}"\n  :stroke-width="${stroke.value}" color="${color.value}" />`,
)
async function copy(text: string, label: string) {
  copyNote.value = ''
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(text)
    copyNote.value = `${label}已复制。`
  } catch {
    copyNote.value = '浏览器未开放剪贴板，请选择下方代码后复制。'
  }
}
function copySvg() {
  const svg = live.value?.querySelector('svg')
  if (!svg) return
  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute('stroke', getComputedStyle(svg).color)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  void copy(clone.outerHTML, 'SVG')
}
function clearFilters() {
  query.value = ''
  category.value = '全部'
}
function select(name: string) {
  selected.value = name
  copyNote.value = ''
  void nextTick(() => {
    const workspace = live.value?.closest('.demo-icon-workspace')
    if (workspace && workspace.clientWidth < 1040)
      live.value?.closest('aside')?.scrollIntoView?.({ block: 'start' })
  })
}
</script>
<template>
  <NovaTheme :model-value="appearance" class="demo-icon-workspace">
    <div ref="browser" class="demo-icon-browser">
      <div class="demo-panel demo-icon-toolbar">
        <div>
          <h2>Lucide 图标库</h2>
          <p>{{ catalog.length }} 个精选图标，已用于账户导航、表单和业务操作。</p>
        </div>
        <div class="demo-compact-search">
          <NovaField v-model="query" label="搜索图标" type="search" placeholder="搜索名称或用途"
            ><template #prefix><NovaIcon name="search" /></template
          ></NovaField>
        </div>
      </div>
      <div role="group" aria-label="图标分类" class="demo-filter-tabs demo-icon-categories">
        <button
          v-for="group in groups"
          :key="group"
          type="button"
          :aria-pressed="category === group"
          @click="category = group"
        >
          {{ group }}
        </button>
      </div>
      <p class="demo-scene-meta">{{ visible.length }} 个结果 · 选择图标查看参数与用法</p>
      <div v-if="visible.length" class="demo-icon-grid">
        <button
          v-for="item in visible"
          :key="item.name"
          type="button"
          :aria-pressed="selected === item.name"
          :aria-label="`选择图标 ${item.label} ${item.name}`"
          :title="item.name"
          @click="select(item.name)"
        >
          <NovaIcon :icon="item.component" :size="24" :stroke-width="stroke" /><strong>{{
            item.label
          }}</strong
          ><span>{{ item.name }}</span>
        </button>
      </div>
      <div v-else class="demo-panel demo-empty">
        <NovaIcon name="search" />
        <h3>没有找到匹配的图标</h3>
        <p>可按英文名称或中文用途查找。</p>
        <NovaButton variant="ghost" @click="clearFilters">清空筛选</NovaButton>
      </div>
      <p class="demo-scene-meta">
        图标来自
        <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">Lucide</a>，采用 ISC
        许可；部分图标衍生自 Feather（MIT）。许可随项目一起提供。
      </p>
    </div>
    <aside class="demo-panel demo-icon-inspector" aria-label="图标预览与用法">
      <NovaButton class="demo-icon-return" variant="ghost" @click="returnToCatalog">
        <NovaIcon :icon="ArrowLeft" :size="16" />返回图标列表
      </NovaButton>
      <div class="demo-panel-heading">
        <div>
          <h2>{{ current.name }}</h2>
          <p>{{ current.label }} · {{ current.category }}</p>
        </div>
        <code>SVG</code>
      </div>
      <div ref="live" class="demo-icon-live" :style="{ color }">
        <NovaIcon :icon="current.component" :size="size" :stroke-width="stroke" />
      </div>
      <div class="demo-icon-controls">
        <label
          >尺寸<select v-model.number="size" aria-label="尺寸">
            <option v-for="value in [16, 20, 24, 32, 40, 48, 64]" :key="value" :value="value">
              {{ value }} px
            </option>
          </select></label
        ><label
          >线宽<select v-model.number="stroke" aria-label="线宽">
            <option v-for="value in [1, 1.5, 1.75, 2, 2.5]" :key="value" :value="value">
              {{ value }}
            </option>
          </select></label
        ><label
          >颜色<select v-model="color" aria-label="颜色">
            <option value="var(--na-brand)">品牌色</option>
            <option value="var(--na-ink)">正文色</option>
            <option value="var(--na-muted)">次要色</option>
          </select></label
        ><label
          >用法<select v-model="source" aria-label="用法">
            <option value="nova">NovaIcon</option>
            <option value="lucide">Lucide 原生组件</option>
          </select></label
        >
      </div>
      <div class="demo-icon-context">
        <h3>放进真实操作</h3>
        <NovaButton variant="primary" @click="copyNote = `已触发「${current.label}」图标按钮。`"
          ><NovaIcon :icon="current.component" :size="18" :stroke-width="stroke" />{{
            current.label
          }}</NovaButton
        ><span class="demo-icon-context-label"
          ><NovaIcon :icon="current.component" :size="16" />{{ current.label }}状态</span
        >
      </div>
      <pre
        class="demo-icon-code"
        tabindex="0"
        aria-label="图标使用代码"
      ><code>{{ code }}</code></pre>
      <div class="demo-scene-row">
        <NovaButton @click="copy(code, '用法代码')"
          ><NovaIcon name="copy" :size="16" />复制用法</NovaButton
        ><NovaButton variant="ghost" @click="copySvg">复制 SVG</NovaButton>
      </div>
      <p role="status" class="demo-icon-copy-note">
        {{ copyNote || '纯装饰图标默认隐藏于读屏；独立含义可传 label。' }}
      </p>
    </aside>
  </NovaTheme>
</template>
