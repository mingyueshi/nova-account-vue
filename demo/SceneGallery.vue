<script setup lang="ts">
import { Eye } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import type { Appearance } from '../src'
import { NovaButton, NovaDialog, NovaField, NovaTheme } from '../src'
import NovaIcon from '../src/components/NovaIcon.vue'
import DemoUsage from './DemoUsage.vue'
import { useWorkspace } from './useWorkspace'
import './scene-gallery.css'

const props = withDefaults(defineProps<{ appearance?: Appearance; active?: boolean }>(), {
  active: true,
})
defineEmits<{ components: [name: string] }>()
const previewId = useId()
const taskDetailId = useId()
const { root: workspace, wide } = useWorkspace()
function focusInvalid(event?: Event) {
  const form = event?.currentTarget as HTMLFormElement | null
  void nextTick(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
const activeScene = defineModel<string>('activeScene', { default: 'tasks' })
const scenes = [
  {
    key: 'tasks',
    parts: ['NovaField', 'NovaButton'],
    steps: [
      '添加一条任务，按 Enter 即可提交。',
      '勾选完成，按状态筛选；搜索标题可快速定位。',
      '删除后可以撤销，切换账户页会保留当前任务。',
    ],
  },
  {
    key: 'editor',
    parts: ['NovaField', 'NovaButton'],
    steps: [
      '填写标题与正文，也可以填入示例内容。',
      '打开预览检查排版，然后保存草稿。',
      '保存后继续编辑，状态会提示尚未保存的修改。',
    ],
  },
  {
    key: 'comments',
    parts: ['NovaField', 'NovaButton'],
    steps: [
      '发布你的看法，最新的评论会显示在最前面。',
      '点赞可以再次点击取消；按最受赞排序查看讨论。',
    ],
  },
  {
    key: 'orders',
    parts: ['NovaButton', 'NovaDialog'],
    steps: [
      '按订单状态筛选，或搜索商品与订单号。',
      '打开待支付订单的详情，查看金额后体验模拟支付。',
      '模拟支付后，订单进入待发货状态，不会产生真实交易。',
    ],
  },
]
const currentScene = computed(
  () => scenes.find((scene) => scene.key === activeScene.value) ?? scenes[0]!,
)
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(action: () => void, delay: number) {
  const timer = setTimeout(() => {
    timers.delete(timer)
    action()
  }, delay)
  timers.add(timer)
}
onBeforeUnmount(() => timers.forEach((timer) => clearTimeout(timer)))

interface Task {
  id: number
  title: string
  done: boolean
  note?: string
  due?: string
  priority?: string
}
let taskSeq = 3
const tasks = ref<Task[]>([
  { id: 1, title: '核对发票', done: false },
  { id: 2, title: '回复客户邮件', done: true },
  { id: 3, title: '整理周报提纲', done: false },
])
const selectedTaskId = ref(1)
const selectedTask = computed(() => tasks.value.find((task) => task.id === selectedTaskId.value))
const taskDetail = ref<HTMLElement>()
function selectTask(task: Task) {
  selectedTaskId.value = task.id
  if (!wide.value)
    void nextTick(() => {
      taskDetail.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      taskDetail.value?.focus({ preventScroll: true })
    })
}
const taskQuery = ref('')
const taskFilter = ref<'all' | 'open' | 'done'>('all')
const taskDraft = ref('')
const taskError = ref('')
const taskNote = ref('')
const removedTask = ref<{ task: Task; index: number } | null>(null)
const taskFilters = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '进行中' },
  { key: 'done', label: '已完成' },
] as const
const doneCount = computed(() => tasks.value.filter((task) => task.done).length)
const taskCounts = computed(() => ({
  all: tasks.value.length,
  open: tasks.value.length - doneCount.value,
  done: doneCount.value,
}))
const visibleTasks = computed(() =>
  tasks.value.filter(
    (task) =>
      (taskFilter.value === 'all' || (taskFilter.value === 'done') === task.done) &&
      task.title.toLocaleLowerCase().includes(taskQuery.value.trim().toLocaleLowerCase()),
  ),
)
watch(taskDraft, (value) => {
  if (value.trim()) taskError.value = ''
})
function addTask(event?: Event) {
  const title = taskDraft.value.trim()
  if (!title) {
    taskError.value = '请输入任务内容。'
    focusInvalid(event)
    return
  }
  taskError.value = ''
  const id = ++taskSeq
  tasks.value.unshift({ id, title, done: false })
  selectedTaskId.value = id
  taskDraft.value = ''
  taskQuery.value = ''
  taskFilter.value = 'all'
  removedTask.value = null
  taskNote.value = `已添加「${title}」。`
}
function toggleTask(task: Task) {
  task.done = !task.done
  taskNote.value = task.done ? `已完成「${task.title}」。` : `「${task.title}」已恢复为进行中。`
}
function removeTask(id: number) {
  const index = tasks.value.findIndex((task) => task.id === id)
  if (index < 0) return
  const task = tasks.value[index]!
  removedTask.value = { task: { ...task }, index }
  tasks.value.splice(index, 1)
  taskNote.value = `已删除「${task.title}」。`
}
function undoTask() {
  if (!removedTask.value) return
  tasks.value.splice(removedTask.value.index, 0, removedTask.value.task)
  removedTask.value = null
  taskFilter.value = 'all'
  taskQuery.value = ''
  taskNote.value = '任务已恢复。'
}
function resetTaskFilter() {
  taskQuery.value = ''
  taskFilter.value = 'all'
}

const post = reactive({ title: '', body: '' })
const postTitleError = ref('')
const postBodyError = ref('')
const postBusy = ref(false)
const postSaved = ref('')
const savedPost = ref<{ title: string; body: string } | null>(null)
const postDirty = computed(() =>
  savedPost.value
    ? post.title !== savedPost.value.title || post.body !== savedPost.value.body
    : !!(post.title || post.body),
)
const previewMode = ref<'auto' | 'show' | 'hide'>('auto')
const previewOn = computed({
  get: () => previewMode.value === 'show' || (previewMode.value === 'auto' && wide.value),
  set: (value: boolean) => {
    previewMode.value = value ? 'show' : 'hide'
  },
})
function savePost(event?: Event) {
  if (postBusy.value) return
  postTitleError.value = post.title.trim() ? '' : '标题不能为空。'
  postBodyError.value = post.body.trim() ? '' : '正文不能为空。'
  if (postTitleError.value || postBodyError.value) {
    focusInvalid(event)
    return
  }
  const draft = { ...post }
  postBusy.value = true
  postSaved.value = ''
  later(() => {
    savedPost.value = draft
    postBusy.value = false
    postSaved.value = `已保存《${draft.title.trim()}》到内存（演示，刷新即清空）。`
  }, 700)
}
function clearPost() {
  if (postBusy.value) return
  post.title = ''
  post.body = ''
  postTitleError.value = ''
  postBodyError.value = ''
  postSaved.value = ''
  savedPost.value = null
  previewOn.value = false
}
function fillPost() {
  post.title = '让工作台更好用的三个小习惯'
  post.body =
    '先记录，再专注。\n\n把想到的事情写进任务清单，每次只处理一件。完成后及时回顾，让下一步更清楚。'
}
watch(
  () => post.title,
  (value) => {
    if (value.trim()) postTitleError.value = ''
  },
)
watch(
  () => post.body,
  (value) => {
    if (value.trim()) postBodyError.value = ''
  },
)

interface Comment {
  id: number
  author: string
  at: string
  body: string
  likes: number
  liked: boolean
}
let commentSeq = 3
const comments = ref<Comment[]>([
  {
    id: 1,
    author: '林岚',
    at: '昨天 14:02',
    body: '字段的前缀插槽正好能做单位提示。',
    likes: 6,
    liked: false,
  },
  {
    id: 2,
    author: '陈默',
    at: '周一 09:30',
    body: '列表空态和错误态的对比很清楚。',
    likes: 2,
    liked: false,
  },
  {
    id: 3,
    author: '苏黎',
    at: '3 天前',
    body: '希望补充一个树形列表的场景。',
    likes: 0,
    liked: false,
  },
])
const commentDraft = ref('')
const commentError = ref('')
const commentBusy = ref(false)
const commentNote = ref('')
const commentSort = ref('latest')
const sortedComments = computed(() =>
  commentSort.value === 'popular'
    ? [...comments.value].sort((a, b) => b.likes - a.likes)
    : comments.value,
)
watch(commentDraft, (value) => {
  if (value.trim()) commentError.value = ''
})
function publishComment(event?: Event) {
  if (commentBusy.value) return
  const body = commentDraft.value.trim()
  if (!body) {
    commentError.value = '评论内容不能为空。'
    focusInvalid(event)
    return
  }
  commentError.value = ''
  commentNote.value = ''
  commentBusy.value = true
  later(() => {
    commentBusy.value = false
    comments.value.unshift({
      id: ++commentSeq,
      author: '你',
      at: '刚刚',
      body,
      likes: 0,
      liked: false,
    })
    commentDraft.value = ''
    commentSort.value = 'latest'
    commentNote.value = '评论已发布。'
  }, 700)
}
function toggleLike(comment: Comment) {
  comment.liked = !comment.liked
  comment.likes += comment.liked ? 1 : -1
}

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'done'
interface Order {
  id: string
  title: string
  status: OrderStatus
  placedAt: string
  items: { name: string; qty: number; price: number }[]
}
const statusLabels: Record<OrderStatus, string> = {
  pending: '待支付',
  processing: '待发货',
  shipped: '已发货',
  done: '已完成',
}
const orders = ref<Order[]>([
  {
    id: 'NO-2026-0817',
    title: '桌面显示器支架',
    status: 'pending',
    placedAt: '11-10 18:44',
    items: [
      { name: '显示器支架', qty: 1, price: 189 },
      { name: '理线器套装', qty: 2, price: 19.5 },
    ],
  },
  {
    id: 'NO-2026-0802',
    title: '机械键盘（青轴）',
    status: 'shipped',
    placedAt: '11-06 12:10',
    items: [{ name: '机械键盘', qty: 1, price: 329 }],
  },
  {
    id: 'NO-2026-0793',
    title: '笔记本支架与桌垫',
    status: 'done',
    placedAt: '11-02 21:05',
    items: [
      { name: '笔记本支架', qty: 1, price: 99 },
      { name: '桌垫', qty: 1, price: 45 },
    ],
  },
])
const orderFilters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待支付' },
  { key: 'processing', label: '待发货' },
  { key: 'shipped', label: '已发货' },
  { key: 'done', label: '已完成' },
] as const
const orderFilter = ref<'all' | OrderStatus>('all')
const orderQuery = ref('')
const orderCounts = computed(
  () =>
    Object.fromEntries(
      orderFilters.map((filter) => [
        filter.key,
        filter.key === 'all'
          ? orders.value.length
          : orders.value.filter((order) => order.status === filter.key).length,
      ]),
    ) as Record<'all' | OrderStatus, number>,
)
const visibleOrders = computed(() =>
  orders.value.filter(
    (order) =>
      (orderFilter.value === 'all' || order.status === orderFilter.value) &&
      `${order.id} ${order.title} ${order.items.map((item) => item.name).join(' ')}`
        .toLocaleLowerCase()
        .includes(orderQuery.value.trim().toLocaleLowerCase()),
  ),
)
const selectedOrderId = ref('NO-2026-0817')
const inspectedOrder = computed(() =>
  orders.value.find((order) => order.id === selectedOrderId.value),
)
const openOrderId = ref('')
watch([() => props.active, activeScene], ([active, scene]) => {
  if (!active || scene !== 'orders') openOrderId.value = ''
})
const activeOrder = computed(
  () => orders.value.find((order) => order.id === openOrderId.value) ?? null,
)
const payingIds = reactive(new Set<string>())
const paymentNotes = reactive<Record<string, string>>({})
const paying = computed(() => !!activeOrder.value && payingIds.has(activeOrder.value.id))
const cny = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
function orderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0) / 100
}
function openOrder(id: string) {
  selectedOrderId.value = id
  openOrderId.value = id
}
function payOrder() {
  const order = activeOrder.value
  if (!order || payingIds.has(order.id) || order.status !== 'pending') return
  payingIds.add(order.id)
  later(() => {
    order.status = 'processing'
    payingIds.delete(order.id)
    paymentNotes[order.id] = '模拟支付完成，订单等待发货。'
  }, 800)
}
function resetOrderFilter() {
  orderQuery.value = ''
  orderFilter.value = 'all'
}
</script>
<template>
  <div ref="workspace" class="demo-showcase">
    <div class="demo-scenes">
      <section v-show="activeScene === 'tasks'" class="demo-scene-cell" aria-label="任务清单">
        <NovaTheme :model-value="appearance">
          <div class="demo-task-workspace">
            <div class="demo-panel">
              <div class="demo-panel-heading">
                <div>
                  <h2>任务清单</h2>
                  <p>记录、完成，再安排下一步。</p>
                </div>
                <span class="demo-subtle-count">共 {{ tasks.length }} 项</span>
              </div>
              <form aria-label="任务添加" class="demo-task-composer" @submit.prevent="addTask">
                <NovaField
                  v-model="taskDraft"
                  label="新任务"
                  :maxlength="80"
                  placeholder="添加一件要做的事…"
                  autocomplete="off"
                  :error="taskError"
                />
                <NovaButton type="submit" variant="primary"
                  ><NovaIcon name="plus" />添加</NovaButton
                >
              </form>
              <div class="demo-list-toolbar">
                <div role="group" aria-label="任务状态筛选" class="demo-filter-tabs">
                  <button
                    v-for="filter in taskFilters"
                    :key="filter.key"
                    type="button"
                    :aria-pressed="taskFilter === filter.key"
                    @click="taskFilter = filter.key"
                  >
                    {{ filter.label }}<span>{{ taskCounts[filter.key] }}</span>
                  </button>
                </div>
                <div class="demo-compact-search">
                  <NovaField
                    v-model="taskQuery"
                    label="搜索任务"
                    type="search"
                    placeholder="搜索任务"
                    autocomplete="off"
                    ><template #prefix><NovaIcon name="search" /></template
                  ></NovaField>
                </div>
              </div>
              <ul class="demo-task-list">
                <li
                  v-for="task in visibleTasks"
                  :key="task.id"
                  class="demo-scene-item demo-task-item"
                  :class="{ 'is-done': task.done, 'is-selected': selectedTaskId === task.id }"
                >
                  <label class="demo-scene-check"
                    ><input type="checkbox" :checked="task.done" @change="toggleTask(task)" /><span
                      :class="{ 'demo-scene-done': task.done }"
                      >{{ task.title }}</span
                    ></label
                  >
                  <div class="demo-task-row-actions">
                    <button
                      type="button"
                      class="demo-icon-button"
                      :aria-label="`查看任务 ${task.title}`"
                      :aria-pressed="selectedTaskId === task.id"
                      @click="selectTask(task)"
                    >
                      <NovaIcon name="chevron" /></button
                    ><button
                      type="button"
                      class="demo-icon-button"
                      :aria-label="`删除任务 ${task.title}`"
                      @click="removeTask(task.id)"
                    >
                      <NovaIcon name="trash" />
                    </button>
                  </div>
                </li>
                <li v-if="!visibleTasks.length" class="demo-empty">
                  <NovaIcon :name="taskQuery ? 'search' : 'tasks'" />
                  <h3>
                    {{
                      taskQuery
                        ? '没有找到匹配的任务'
                        : taskFilter === 'done'
                          ? '还没有已完成的任务'
                          : taskFilter === 'open'
                            ? '待办已全部完成'
                            : '从第一条任务开始'
                    }}
                  </h3>
                  <p>
                    {{
                      taskQuery
                        ? '试试其他关键词，或清空筛选查看全部。'
                        : '把想做的事情记下来，完成后勾选即可。'
                    }}
                  </p>
                  <NovaButton
                    v-if="taskQuery || taskFilter !== 'all'"
                    variant="ghost"
                    @click="resetTaskFilter"
                    >查看全部任务</NovaButton
                  >
                </li>
              </ul>
              <div class="demo-list-footer">
                <span>进行中 {{ tasks.length - doneCount }} · 已完成 {{ doneCount }}</span
                ><span class="demo-scene-meta">数据仅保存在本页</span>
              </div>
              <div v-if="taskNote" class="demo-inline-notice">
                <span role="status">{{ taskNote }}</span
                ><button
                  v-if="removedTask"
                  type="button"
                  class="demo-link-button"
                  @click="undoTask"
                >
                  <NovaIcon name="undo" />撤销删除
                </button>
              </div>
            </div>
            <aside
              ref="taskDetail"
              class="demo-panel demo-task-detail"
              tabindex="-1"
              :aria-labelledby="taskDetailId"
            >
              <div class="demo-panel-heading">
                <div>
                  <h2 :id="taskDetailId">任务详情</h2>
                  <p>在清单旁补充信息，变更即时保留。</p>
                </div>
                <NovaIcon name="tasks" />
              </div>
              <template v-if="selectedTask"
                ><h3>{{ selectedTask.title }}</h3>
                <span class="demo-task-state" :data-done="selectedTask.done">{{
                  selectedTask.done ? '已完成' : '进行中'
                }}</span>
                <div class="demo-task-detail-fields">
                  <NovaField
                    :model-value="selectedTask.note || ''"
                    label="任务备注"
                    as="textarea"
                    :rows="5"
                    :maxlength="200"
                    placeholder="补充执行要点或相关信息…"
                    @update:model-value="selectedTask.note = $event"
                  /><NovaField
                    :model-value="selectedTask.due || ''"
                    label="计划日期"
                    type="date"
                    @update:model-value="selectedTask.due = $event"
                  /><label class="demo-native-field"
                    >优先级<select
                      :value="selectedTask.priority || 'normal'"
                      @change="selectedTask.priority = ($event.target as HTMLSelectElement).value"
                    >
                      <option value="normal">普通</option>
                      <option value="high">优先处理</option>
                      <option value="low">稍后安排</option>
                    </select></label
                  >
                </div>
                <NovaButton
                  :variant="selectedTask.done ? 'secondary' : 'primary'"
                  @click="toggleTask(selectedTask)"
                  ><NovaIcon name="check" :size="16" />{{
                    selectedTask.done ? '恢复为进行中' : '标记为完成'
                  }}</NovaButton
                >
                <p class="demo-scene-meta">详情仅保存在本页内存，刷新后重置。</p></template
              >
              <div v-else class="demo-empty">
                <NovaIcon name="tasks" />
                <h3>选择一条任务</h3>
                <p>点击清单中的详情按钮，在这里补充信息。</p>
              </div>
            </aside>
          </div>
        </NovaTheme>
      </section>

      <section v-show="activeScene === 'editor'" class="demo-scene-cell" aria-label="文章编辑器">
        <NovaTheme :model-value="appearance">
          <div class="demo-panel">
            <div class="demo-panel-heading">
              <div>
                <h2>文章草稿</h2>
                <p>先把想法写下来，排版会在预览中呈现。</p>
              </div>
              <span class="demo-draft-state" :data-saved="!!savedPost && !postDirty"
                ><span aria-hidden="true">●</span
                >{{
                  postBusy
                    ? '正在保存'
                    : postDirty
                      ? '有未保存的修改'
                      : savedPost
                        ? '已保存'
                        : '尚未开始'
                }}</span
              >
            </div>
            <div class="demo-editor-layout" :class="{ 'with-preview': previewOn }">
              <form
                aria-label="保存文章"
                class="demo-scene-form demo-editor-form"
                @submit.prevent="savePost"
              >
                <NovaField
                  v-model="post.title"
                  label="文章标题"
                  :maxlength="40"
                  placeholder="给这篇内容起个标题"
                  autocomplete="off"
                  :hint="`${post.title.length} / 40 字符`"
                  :error="postTitleError"
                />
                <NovaField
                  v-model="post.body"
                  as="textarea"
                  label="正文"
                  :rows="10"
                  :maxlength="200"
                  placeholder="写下你的想法，支持换行…"
                  :hint="`已输入 ${post.body.length}/200 字符`"
                  :error="postBodyError"
                />
                <div class="demo-editor-actions">
                  <div class="demo-scene-row">
                    <NovaButton type="submit" variant="primary" :busy="postBusy"
                      ><NovaIcon v-if="!postBusy" name="save" :size="16" />保存草稿</NovaButton
                    ><NovaButton
                      :aria-pressed="previewOn"
                      :aria-controls="previewOn ? previewId : undefined"
                      :aria-expanded="previewOn"
                      @click="previewOn = !previewOn"
                      ><NovaIcon :icon="Eye" :size="16" />预览</NovaButton
                    >
                  </div>
                  <NovaButton v-if="!post.title && !post.body" variant="ghost" @click="fillPost"
                    >填入示例内容</NovaButton
                  ><NovaButton v-else variant="ghost" :disabled="postBusy" @click="clearPost"
                    ><NovaIcon name="trash" :size="16" />清空</NovaButton
                  >
                </div>
              </form>
              <aside
                v-if="previewOn"
                :id="previewId"
                class="demo-scene-preview demo-article-preview"
                aria-label="文章预览"
              >
                <span class="demo-scene-meta">内容预览</span>
                <h3>{{ post.title.trim() || '等待你的标题' }}</h3>
                <p>{{ post.body.trim() || '填写正文后，即可在这里检查内容与段落。' }}</p>
              </aside>
            </div>
            <p v-if="postSaved && !postDirty" role="status" class="demo-success-note">
              <NovaIcon name="check" />{{ postSaved }}
            </p>
            <p v-else class="demo-scene-meta demo-editor-status">
              {{
                postBusy
                  ? '正在保存当前版本，你可以继续编辑。'
                  : '切换账户页会保留草稿；刷新页面后重置。'
              }}
            </p>
          </div>
        </NovaTheme>
      </section>

      <section v-show="activeScene === 'comments'" class="demo-scene-cell" aria-label="社区讨论">
        <NovaTheme :model-value="appearance">
          <div class="demo-community-page">
            <div class="demo-discussion-topic">
              <span class="demo-topic-icon"><NovaIcon name="comments" /></span>
              <div>
                <h2>你最想完善哪一个交互细节？</h2>
                <p>分享使用中的发现，或给其他人的建议点个赞。</p>
              </div>
            </div>
            <div class="demo-community-workspace">
              <form
                aria-label="发布评论"
                class="demo-comment-composer demo-panel"
                @submit.prevent="publishComment"
              >
                <span class="demo-scene-avatar demo-current-avatar" aria-hidden="true">你</span>
                <div class="demo-scene-form">
                  <NovaField
                    v-model="commentDraft"
                    as="textarea"
                    label="发表评论"
                    :rows="3"
                    :maxlength="120"
                    :disabled="commentBusy"
                    placeholder="写下你的建议，让讨论更有帮助…"
                    :hint="`已输入 ${commentDraft.length}/120 字符`"
                    :error="commentError"
                  />
                  <div class="demo-comment-compose-footer">
                    <span class="demo-scene-meta">以演示用户身份参与讨论</span
                    ><NovaButton type="submit" variant="primary" :busy="commentBusy"
                      >发布</NovaButton
                    >
                  </div>
                </div>
              </form>
              <div class="demo-community-feed demo-panel">
                <div class="demo-discussion-toolbar">
                  <h3>{{ comments.length }} 条评论</h3>
                  <label class="demo-sort-control"
                    >排序<select v-model="commentSort">
                      <option value="latest">最新发布</option>
                      <option value="popular">最受赞</option>
                    </select></label
                  >
                </div>
                <p v-if="commentNote" role="status" class="demo-success-note">{{ commentNote }}</p>
                <ul class="demo-comment-list">
                  <li
                    v-for="comment in sortedComments"
                    :key="comment.id"
                    class="demo-scene-comment"
                  >
                    <span
                      class="demo-scene-avatar"
                      :data-avatar="comment.id % 3"
                      aria-hidden="true"
                      >{{ comment.author.slice(0, 1) }}</span
                    >
                    <div class="demo-scene-grow">
                      <div class="demo-comment-byline">
                        <strong>{{ comment.author }}</strong
                        ><span>{{ comment.at }}</span
                        ><span v-if="comment.author === '你'" class="demo-own-label">我</span>
                      </div>
                      <p class="demo-comment-body">{{ comment.body }}</p>
                      <button
                        type="button"
                        class="demo-like-button"
                        :aria-pressed="comment.liked"
                        :aria-label="`赞 ${comment.likes}，${comment.author}的评论`"
                        @click="toggleLike(comment)"
                      >
                        <NovaIcon name="like" />赞 {{ comment.likes }}
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </NovaTheme>
      </section>

      <section v-show="activeScene === 'orders'" class="demo-scene-cell" aria-label="订单列表">
        <NovaTheme :model-value="appearance">
          <div class="demo-orders">
            <div class="demo-panel demo-orders-toolbar">
              <div role="group" aria-label="订单状态筛选" class="demo-filter-tabs">
                <button
                  v-for="filter in orderFilters"
                  :key="filter.key"
                  type="button"
                  :aria-pressed="orderFilter === filter.key"
                  @click="orderFilter = filter.key"
                >
                  {{ filter.label }}<span>{{ orderCounts[filter.key] }}</span>
                </button>
              </div>
              <div class="demo-compact-search">
                <NovaField
                  v-model="orderQuery"
                  label="搜索订单"
                  type="search"
                  placeholder="商品名称或订单号"
                  ><template #prefix><NovaIcon name="search" /></template
                ></NovaField>
              </div>
            </div>
            <div class="demo-order-workspace">
              <ul class="demo-order-list">
                <li
                  v-for="order in visibleOrders"
                  :key="order.id"
                  class="demo-order-card"
                  :class="{ 'is-selected': selectedOrderId === order.id }"
                >
                  <div class="demo-order-heading">
                    <div>
                      <button
                        type="button"
                        class="demo-order-select"
                        :aria-pressed="selectedOrderId === order.id"
                        :aria-label="`选择订单 ${order.id}`"
                        @click="selectedOrderId = order.id"
                      >
                        {{ order.id }}</button
                      ><time>{{ order.placedAt }}</time>
                    </div>
                    <span class="demo-scene-status" :data-status="order.status"
                      ><span aria-hidden="true">●</span>{{ statusLabels[order.status] }}</span
                    >
                  </div>
                  <div class="demo-order-body">
                    <span class="demo-product-icon" aria-hidden="true"
                      ><NovaIcon name="orders"
                    /></span>
                    <div class="demo-order-summary">
                      <h2>{{ order.title }}</h2>
                      <p>
                        {{ order.items.map((item) => `${item.name} × ${item.qty}`).join('、') }}
                      </p>
                    </div>
                    <div class="demo-order-amount">
                      <strong>{{ cny.format(orderTotal(order)) }}</strong
                      ><span
                        >共
                        {{ order.items.reduce((count, item) => count + item.qty, 0) }} 件商品</span
                      >
                    </div>
                  </div>
                  <div class="demo-order-footer">
                    <span class="demo-scene-meta">{{
                      order.status === 'pending'
                        ? '等待付款，确认后进入待发货。'
                        : order.status === 'processing'
                          ? '支付已完成，等待安排发货。'
                          : order.status === 'shipped'
                            ? '商品已发出，请留意签收。'
                            : '订单已完成，感谢你的支持。'
                    }}</span
                    ><NovaButton
                      :variant="order.status === 'pending' ? 'primary' : 'secondary'"
                      :data-order-id="order.id"
                      :aria-label="`${order.status === 'pending' ? '查看并支付' : '查看详情'}订单 ${order.id}`"
                      @click="openOrder(order.id)"
                      >{{ order.status === 'pending' ? '查看并支付' : '查看详情' }}</NovaButton
                    >
                  </div>
                </li>
                <li v-if="!visibleOrders.length" class="demo-panel demo-empty">
                  <NovaIcon :name="orderQuery ? 'search' : 'orders'" />
                  <h3>{{ orderQuery ? '没有找到匹配的订单' : '该状态下暂无订单。' }}</h3>
                  <p>试试其他状态，或查看全部订单。</p>
                  <NovaButton variant="ghost" @click="resetOrderFilter">查看全部订单</NovaButton>
                </li>
              </ul>
              <aside
                v-if="inspectedOrder"
                class="demo-panel demo-order-inspector"
                aria-label="订单摘要"
              >
                <div class="demo-panel-heading">
                  <div>
                    <h2>订单摘要</h2>
                    <p>{{ inspectedOrder.id }}</p>
                  </div>
                  <span class="demo-scene-status" :data-status="inspectedOrder.status">{{
                    statusLabels[inspectedOrder.status]
                  }}</span>
                </div>
                <h3>{{ inspectedOrder.title }}</h3>
                <ul class="demo-order-detail-items">
                  <li v-for="item in inspectedOrder.items" :key="item.name">
                    <div>
                      <strong>{{ item.name }}</strong
                      ><span>{{ cny.format(item.price) }} × {{ item.qty }}</span>
                    </div>
                    <strong>{{
                      cny.format((Math.round(item.price * 100) * item.qty) / 100)
                    }}</strong>
                  </li>
                </ul>
                <p class="demo-scene-total">
                  <span>合计</span><strong>{{ cny.format(orderTotal(inspectedOrder)) }}</strong>
                </p>
                <div class="demo-order-inspector-status">
                  <NovaIcon :name="inspectedOrder.status === 'pending' ? 'clock' : 'check'" />
                  <div>
                    <h4>{{ statusLabels[inspectedOrder.status] }}</h4>
                    <p>
                      {{
                        inspectedOrder.status === 'pending'
                          ? '核对商品与金额后，可打开详情体验模拟支付。'
                          : inspectedOrder.status === 'processing'
                            ? '模拟支付已完成，订单等待发货。'
                            : inspectedOrder.status === 'shipped'
                              ? '商品已发出，请留意签收。'
                              : '本次订单已完成。'
                      }}
                    </p>
                  </div>
                </div>
                <NovaButton
                  :variant="inspectedOrder.status === 'pending' ? 'primary' : 'secondary'"
                  @click="openOrder(inspectedOrder.id)"
                  >打开订单详情<NovaIcon name="chevron" :size="16"
                /></NovaButton>
                <p class="demo-scene-meta">列表与摘要状态同步更新。</p>
              </aside>
            </div>
            <p class="demo-scene-meta">所有订单与支付均为模拟，不会产生真实交易。</p>
            <NovaDialog
              v-if="activeOrder"
              :open="true"
              :title="`订单详情 ${activeOrder.id}`"
              @close="openOrderId = ''"
              ><div class="demo-order-dialog-meta">
                <span class="demo-scene-status" :data-status="activeOrder.status">{{
                  statusLabels[activeOrder.status]
                }}</span
                ><span>下单于 {{ activeOrder.placedAt }}</span>
              </div>
              <h3 class="demo-order-dialog-title">{{ activeOrder.title }}</h3>
              <ul class="demo-order-detail-items">
                <li v-for="item in activeOrder.items" :key="item.name">
                  <div>
                    <strong>{{ item.name }}</strong
                    ><span>单价 {{ cny.format(item.price) }} · 数量 {{ item.qty }}</span>
                  </div>
                  <strong>{{ cny.format((Math.round(item.price * 100) * item.qty) / 100) }}</strong>
                </li>
              </ul>
              <p class="demo-scene-total">
                <span>合计</span><strong>{{ cny.format(orderTotal(activeOrder)) }}</strong>
              </p>
              <p v-if="paymentNotes[activeOrder.id]" role="status" class="demo-success-note">
                <NovaIcon name="check" />{{ paymentNotes[activeOrder.id] }}
              </p>
              <p v-else class="demo-scene-meta demo-payment-note">
                {{
                  paying
                    ? '正在处理模拟支付，可以关闭此窗口后继续浏览。'
                    : activeOrder.status === 'pending'
                      ? '点击下方按钮体验支付反馈，不会真实扣款。'
                      : '当前订单状态与列表同步。'
                }}
              </p>
              <template #footer
                ><div class="demo-dialog-actions">
                  <NovaButton variant="secondary" @click="openOrderId = ''">关闭</NovaButton
                  ><NovaButton
                    v-if="activeOrder.status === 'pending'"
                    variant="primary"
                    :busy="paying"
                    @click="payOrder"
                    >模拟支付</NovaButton
                  >
                </div></template
              ></NovaDialog
            >
          </div>
        </NovaTheme>
      </section>
    </div>
    <DemoUsage
      :components="currentScene.parts"
      :steps="currentScene.steps"
      @component="$emit('components', $event)"
    />
  </div>
</template>
