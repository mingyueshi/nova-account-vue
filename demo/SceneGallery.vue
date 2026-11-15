<script setup lang="ts">
import { Eye } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import type { Appearance } from '../src'
import { NovaButton, NovaDialog, NovaField, NovaTheme } from '../src'
import NovaIcon from '../src/components/NovaIcon.vue'
import { useWorkspace } from './useWorkspace'
import './scene-gallery.css'
import TaskFields from './TaskFields.vue'
import CommentForm from './CommentForm.vue'

const props = withDefaults(defineProps<{ appearance?: Appearance; active?: boolean }>(), {
  active: true,
})
const previewId = useId()
const taskDetailId = useId()
const commentFormId = useId()
const commentDialogId = useId()
const { root: workspace, wide } = useWorkspace()
function focusInvalid(event?: Event) {
  const form = event?.currentTarget as HTMLFormElement | null
  void nextTick(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
const postReceipt = ref<HTMLElement>()
const postForm = ref<HTMLFormElement>()
const commentReceipt = ref<HTMLElement>()
const taskReceipt = ref<HTMLElement>()
async function focusReceipt(scene: 'editor' | 'comments' | 'tasks') {
  await nextTick()
  const el =
    scene === 'editor'
      ? postReceipt.value
      : scene === 'comments'
        ? commentReceipt.value
        : taskReceipt.value
  if (
    el &&
    props.active &&
    activeScene.value === scene &&
    el.ownerDocument.activeElement === el.ownerDocument.body
  )
    el.focus()
}
const activeScene = defineModel<string>('activeScene', { default: 'tasks' })
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
const taskOpen = ref(false)
const taskTrigger = ref<HTMLElement>()
function selectTask(task: Task, event?: Event) {
  selectedTaskId.value = task.id
  taskTrigger.value = event?.currentTarget as HTMLElement | undefined
  if (!wide.value) taskOpen.value = true
}
function updateTask(fields: { note?: string; due?: string; priority?: string }) {
  if (selectedTask.value) Object.assign(selectedTask.value, fields)
}
async function closeTask() {
  taskOpen.value = false
  await nextTick()
  if (props.active && activeScene.value === 'tasks' && !taskTrigger.value?.isConnected)
    taskReceipt.value?.focus()
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
  removedTask.value = null
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
  void focusReceipt('tasks')
}
function undoTask() {
  if (!removedTask.value) return
  tasks.value.splice(removedTask.value.index, 0, removedTask.value.task)
  removedTask.value = null
  taskFilter.value = 'all'
  taskQuery.value = ''
  taskNote.value = '任务已恢复。'
  void focusReceipt('tasks')
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
const previewDialogOpen = ref(false)
const previewTrigger = ref<HTMLElement>()
const clearPostOpen = ref(false)
const clearPostTrigger = ref<HTMLElement>()
const previewOn = computed({
  get: () => previewMode.value === 'show' || (previewMode.value === 'auto' && wide.value),
  set: (value: boolean) => {
    previewMode.value = value ? 'show' : 'hide'
  },
})
const previewExpanded = computed(() => (wide.value ? previewOn.value : previewDialogOpen.value))
function openPreview(event: Event) {
  previewTrigger.value = event.currentTarget as HTMLElement
  if (wide.value) previewOn.value = !previewOn.value
  else previewDialogOpen.value = true
}
function requestClearPost(event: Event) {
  clearPostTrigger.value = event.currentTarget as HTMLElement
  clearPostOpen.value = true
}
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
    postSaved.value = `草稿《${draft.title.trim()}》已保存。`
    void focusReceipt('editor')
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
  clearPostOpen.value = false
  void nextTick(() => {
    if (props.active && activeScene.value === 'editor')
      postForm.value?.querySelector('input')?.focus()
  })
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
    body: '把每天想做的事情记下来，完成一项就划掉，感觉很有成就感。',
    likes: 6,
    liked: false,
  },
  {
    id: 2,
    author: '陈默',
    at: '周一 09:30',
    body: '我习惯先做最重要的一件事，下午再集中回复消息。',
    likes: 2,
    liked: false,
  },
  {
    id: 3,
    author: '苏黎',
    at: '3 天前',
    body: '周末会回顾一下这一周的记录，看看还有什么可以调整。',
    likes: 0,
    liked: false,
  },
])
const commentDraft = ref('')
const commentDialogOpen = ref(false)
const commentTrigger = ref<HTMLElement>()
function openComment(event: Event) {
  commentTrigger.value = event.currentTarget as HTMLElement
  commentDialogOpen.value = true
}
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
    const fromDialog = commentDialogOpen.value && props.active && activeScene.value === 'comments'
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
    commentDialogOpen.value = false
    if (fromDialog) void nextTick(() => commentReceipt.value?.focus())
    else void focusReceipt('comments')
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
const orderTrigger = ref<HTMLElement>()
watch([() => props.active, activeScene], ([active, scene]) => {
  if (!active || scene !== 'orders') openOrderId.value = ''
  if (!active || scene !== 'tasks') taskOpen.value = false
  if (!active || scene !== 'editor') {
    previewDialogOpen.value = false
    clearPostOpen.value = false
  }
  if (!active || scene !== 'comments') commentDialogOpen.value = false
})
watch(wide, (value) => {
  if (value) {
    taskOpen.value = false
    previewDialogOpen.value = false
    commentDialogOpen.value = false
  }
})
const activeOrder = computed(
  () => orders.value.find((order) => order.id === openOrderId.value) ?? null,
)
const payingIds = reactive(new Set<string>())
const paymentNotes = reactive<Record<string, string>>({})
const paymentReceipt = ref<HTMLElement>()
const orderReceipt = ref<HTMLElement>()
const orderFiltersRoot = ref<HTMLElement>()
const orderNotice = ref('')
const paying = computed(() => !!activeOrder.value && payingIds.has(activeOrder.value.id))
const cny = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
function orderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0) / 100
}
function openOrder(id: string, event?: Event) {
  orderTrigger.value = event?.currentTarget as HTMLElement | undefined
  selectedOrderId.value = id
  openOrderId.value = id
}
function selectOrder(id: string, event: Event) {
  if (wide.value) selectedOrderId.value = id
  else openOrder(id, event)
}
async function closeOrder() {
  openOrderId.value = ''
  await nextTick()
  if (props.active && activeScene.value === 'orders' && !orderTrigger.value?.isConnected)
    (
      orderReceipt.value ??
      orderFiltersRoot.value?.querySelector<HTMLElement>('[aria-pressed=true]')
    )?.focus()
}
function payOrder() {
  const order = activeOrder.value
  if (!order || payingIds.has(order.id) || order.status !== 'pending') return
  payingIds.add(order.id)
  later(() => {
    order.status = 'processing'
    payingIds.delete(order.id)
    paymentNotes[order.id] = '支付成功，订单等待发货。'
    orderNotice.value = `订单 ${order.id} 已支付，正在等待发货。`
    void nextTick(() => {
      if (!props.active || activeScene.value !== 'orders') return
      const receipt =
        openOrderId.value === order.id
          ? paymentReceipt.value
          : !openOrderId.value
            ? orderReceipt.value
            : undefined
      const active = receipt?.ownerDocument.activeElement
      if (
        receipt &&
        (active === receipt.ownerDocument.body || active === receipt.closest('dialog'))
      )
        receipt.focus()
    })
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
                  :class="{
                    'is-done': task.done,
                    'is-selected': wide && selectedTaskId === task.id,
                  }"
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
                      :aria-haspopup="!wide ? 'dialog' : undefined"
                      @click="selectTask(task, $event)"
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
                <span>进行中 {{ tasks.length - doneCount }} · 已完成 {{ doneCount }}</span>
              </div>
              <div
                v-if="taskNote"
                ref="taskReceipt"
                tabindex="-1"
                role="status"
                class="demo-inline-notice"
              >
                <span>{{ taskNote }}</span
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
              v-if="wide"
              class="demo-panel demo-task-detail"
              tabindex="-1"
              :aria-labelledby="taskDetailId"
            >
              <div class="demo-panel-heading">
                <div>
                  <h2 :id="taskDetailId">任务详情</h2>
                  <p>补充备注，安排日期与优先级。</p>
                </div>
                <NovaIcon name="tasks" />
              </div>
              <template v-if="selectedTask"
                ><h3>{{ selectedTask.title }}</h3>
                <span class="demo-task-state" :data-done="selectedTask.done">{{
                  selectedTask.done ? '已完成' : '进行中'
                }}</span>
                <TaskFields :task="selectedTask" @change="updateTask" />
                <NovaButton
                  :variant="selectedTask.done ? 'secondary' : 'primary'"
                  @click="toggleTask(selectedTask)"
                  ><NovaIcon name="check" :size="16" />{{
                    selectedTask.done ? '恢复为进行中' : '标记为完成'
                  }}</NovaButton
                >
              </template>
              <div v-else class="demo-empty">
                <NovaIcon name="tasks" />
                <h3>选择一条任务</h3>
                <p>点击清单中的详情按钮，在这里补充信息。</p>
              </div>
            </aside>
          </div>
          <NovaDialog
            v-if="!wide && selectedTask && taskOpen"
            :open="taskOpen"
            title="任务详情"
            :return-focus="taskTrigger"
            class="demo-task-dialog"
            @close="closeTask"
          >
            <h3 class="demo-task-dialog-title">{{ selectedTask.title }}</h3>
            <p class="demo-task-state" :data-done="selectedTask.done" role="status">
              {{ selectedTask.done ? '已完成' : '进行中' }}
            </p>
            <TaskFields v-if="taskOpen" :task="selectedTask" @change="updateTask" />
            <template #footer
              ><div class="demo-dialog-actions">
                <NovaButton variant="secondary" @click="closeTask">关闭</NovaButton
                ><NovaButton
                  :variant="selectedTask.done ? 'secondary' : 'primary'"
                  @click="toggleTask(selectedTask)"
                  >{{ selectedTask.done ? '恢复为进行中' : '标记为完成' }}</NovaButton
                >
              </div></template
            >
          </NovaDialog>
        </NovaTheme>
      </section>

      <section v-show="activeScene === 'editor'" class="demo-scene-cell" aria-label="文章编辑器">
        <NovaTheme :model-value="appearance">
          <div class="demo-panel">
            <div class="demo-panel-heading demo-editor-heading">
              <div>
                <h2>文章草稿</h2>
                <p>把想法写下来，随时保存。</p>
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
                ref="postForm"
                aria-label="保存文章"
                class="demo-scene-form demo-editor-form"
                @submit.prevent="savePost"
              >
                <NovaField
                  v-model="post.title"
                  label="文章标题"
                  :maxlength="80"
                  placeholder="给这篇内容起个标题"
                  autocomplete="off"
                  :hint="`${post.title.length} / 80 字符`"
                  :error="postTitleError"
                />
                <NovaField
                  v-model="post.body"
                  as="textarea"
                  label="正文"
                  :rows="8"
                  :maxlength="5000"
                  placeholder="写下你的想法，支持换行…"
                  :hint="`已输入 ${post.body.length}/5000 字符`"
                  :error="postBodyError"
                />
                <NovaButton
                  v-if="!post.title && !post.body"
                  class="demo-writing-template"
                  variant="ghost"
                  @click="fillPost"
                  >使用写作模板</NovaButton
                >
                <div class="demo-editor-actions" data-mobile-form-actions>
                  <div class="demo-scene-row">
                    <NovaButton
                      type="submit"
                      variant="primary"
                      :busy="postBusy"
                      :disabled="!!savedPost && !postDirty"
                      ><NovaIcon v-if="!postBusy" name="save" :size="16" />保存草稿</NovaButton
                    ><NovaButton
                      :aria-pressed="previewExpanded"
                      :aria-controls="previewExpanded ? previewId : undefined"
                      :aria-expanded="previewExpanded"
                      :aria-haspopup="!wide ? 'dialog' : undefined"
                      @click="openPreview"
                      ><NovaIcon :icon="Eye" :size="16" />预览</NovaButton
                    >
                  </div>
                  <NovaButton
                    v-if="post.title || post.body"
                    variant="ghost"
                    :disabled="postBusy"
                    aria-label="清空"
                    class="demo-clear-post"
                    @click="requestClearPost"
                    ><NovaIcon name="trash" :size="16" /><span>清空</span></NovaButton
                  >
                </div>
              </form>
              <aside
                v-if="wide && previewOn"
                :id="previewId"
                class="demo-scene-preview demo-article-preview"
                aria-label="文章预览"
              >
                <span class="demo-scene-meta">内容预览</span>
                <h3>{{ post.title.trim() || '等待你的标题' }}</h3>
                <p>{{ post.body.trim() || '填写正文后，即可在这里检查内容与段落。' }}</p>
              </aside>
            </div>
            <p
              v-if="postSaved && !postDirty"
              ref="postReceipt"
              role="status"
              tabindex="-1"
              class="demo-success-note"
            >
              <NovaIcon name="check" />{{ postSaved }}
            </p>
            <p v-else class="demo-scene-meta demo-editor-status">
              {{
                postBusy
                  ? '正在保存当前版本，你可以继续编辑。'
                  : postDirty
                    ? '有修改尚未保存。'
                    : '写下想法，随时保存。'
              }}
            </p>
          </div>
          <NovaDialog
            v-if="!wide"
            :id="previewId"
            :open="previewDialogOpen"
            title="文章预览"
            :return-focus="previewTrigger"
            class="demo-preview-dialog"
            @close="previewDialogOpen = false"
          >
            <article
              v-if="previewDialogOpen"
              class="demo-scene-preview demo-article-preview"
              aria-label="文章预览"
            >
              <h3>{{ post.title.trim() || '等待你的标题' }}</h3>
              <p>{{ post.body.trim() || '填写正文后，即可在这里检查内容与段落。' }}</p>
            </article>
            <template v-if="previewDialogOpen" #footer
              ><div class="demo-dialog-actions">
                <NovaButton variant="primary" @click="previewDialogOpen = false"
                  >继续编辑</NovaButton
                >
              </div></template
            >
          </NovaDialog>
          <NovaDialog
            v-if="clearPostOpen"
            :open="clearPostOpen"
            title="清空这篇草稿？"
            :return-focus="clearPostTrigger"
            @close="clearPostOpen = false"
          >
            <p class="demo-clear-description">标题和正文都会被移除，此操作无法撤销。</p>
            <template #footer
              ><div class="demo-dialog-actions">
                <NovaButton variant="secondary" @click="clearPostOpen = false">保留草稿</NovaButton
                ><NovaButton variant="primary" class="demo-destructive" @click="clearPost"
                  >清空内容</NovaButton
                >
              </div></template
            >
          </NovaDialog>
        </NovaTheme>
      </section>

      <section v-show="activeScene === 'comments'" class="demo-scene-cell" aria-label="社区讨论">
        <NovaTheme :model-value="appearance">
          <div class="demo-community-page">
            <div class="demo-discussion-topic">
              <span class="demo-topic-icon"><NovaIcon name="comments" /></span>
              <div>
                <h2>你有哪些让生活更轻松的小习惯？</h2>
                <p>分享日常经验，也为喜欢的想法点个赞。</p>
              </div>
            </div>
            <div class="demo-community-workspace">
              <div v-if="wide" class="demo-comment-composer demo-panel">
                <span class="demo-scene-avatar demo-current-avatar" aria-hidden="true">你</span>
                <CommentForm
                  v-model:draft="commentDraft"
                  :busy="commentBusy"
                  :error="commentError"
                  actions
                  @submit="publishComment"
                />
              </div>
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
                <p
                  v-if="commentNote"
                  ref="commentReceipt"
                  tabindex="-1"
                  role="status"
                  class="demo-success-note"
                >
                  <NovaIcon name="check" />{{ commentNote }}
                </p>
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
              <div v-if="!wide" class="demo-community-mobile-compose">
                <button
                  type="button"
                  class="demo-community-compose-trigger"
                  aria-haspopup="dialog"
                  :aria-controls="commentDialogId"
                  @click="openComment"
                >
                  <NovaIcon name="comments" :size="20" /><span>{{
                    commentDraft || '写下你的想法…'
                  }}</span
                  ><strong>{{ commentDraft ? '继续编辑' : '写评论' }}</strong>
                </button>
              </div>
            </div>
          </div>
          <NovaDialog
            v-if="!wide"
            :id="commentDialogId"
            :open="commentDialogOpen"
            title="写评论"
            :return-focus="commentTrigger"
            @close="commentDialogOpen = false"
          >
            <CommentForm
              v-if="commentDialogOpen"
              :id="commentFormId"
              v-model:draft="commentDraft"
              :busy="commentBusy"
              :error="commentError"
              @submit="publishComment"
            />
            <template v-if="commentDialogOpen" #footer
              ><div class="demo-dialog-actions">
                <NovaButton variant="secondary" @click="commentDialogOpen = false">取消</NovaButton
                ><NovaButton
                  type="submit"
                  :form="commentFormId"
                  variant="primary"
                  :busy="commentBusy"
                  >发布</NovaButton
                >
              </div></template
            >
          </NovaDialog>
        </NovaTheme>
      </section>

      <section v-show="activeScene === 'orders'" class="demo-scene-cell" aria-label="订单列表">
        <NovaTheme :model-value="appearance">
          <div class="demo-orders">
            <div class="demo-panel demo-orders-toolbar">
              <div
                ref="orderFiltersRoot"
                role="group"
                aria-label="订单状态筛选"
                class="demo-filter-tabs"
              >
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
            <p
              v-if="orderNotice"
              ref="orderReceipt"
              tabindex="-1"
              role="status"
              class="demo-success-note demo-order-notice"
            >
              <NovaIcon name="check" />{{ orderNotice }}
            </p>
            <div class="demo-order-workspace">
              <ul class="demo-order-list">
                <li
                  v-for="order in visibleOrders"
                  :key="order.id"
                  class="demo-order-card"
                  :class="{ 'is-selected': wide && selectedOrderId === order.id }"
                >
                  <div class="demo-order-heading">
                    <div>
                      <button
                        type="button"
                        class="demo-order-select"
                        :aria-pressed="wide ? selectedOrderId === order.id : undefined"
                        :aria-label="`${wide ? '选择' : '查看'}订单 ${order.id}`"
                        :aria-haspopup="!wide ? 'dialog' : undefined"
                        @click="selectOrder(order.id, $event)"
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
                      @click="openOrder(order.id, $event)"
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
                v-if="inspectedOrder && wide"
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
                          ? '核对商品与金额，完成支付后开始处理订单。'
                          : inspectedOrder.status === 'processing'
                            ? '订单已支付，等待发货。'
                            : inspectedOrder.status === 'shipped'
                              ? '商品已发出，请留意签收。'
                              : '本次订单已完成。'
                      }}
                    </p>
                  </div>
                </div>
                <NovaButton
                  :variant="inspectedOrder.status === 'pending' ? 'primary' : 'secondary'"
                  @click="openOrder(inspectedOrder.id, $event)"
                  >打开订单详情<NovaIcon name="chevron" :size="16"
                /></NovaButton>
              </aside>
            </div>
            <NovaDialog
              v-if="activeOrder"
              :return-focus="orderTrigger"
              :open="true"
              title="订单详情"
              class="demo-order-dialog"
              @close="closeOrder"
              ><div class="demo-order-dialog-meta">
                <span class="demo-scene-status" :data-status="activeOrder.status">{{
                  statusLabels[activeOrder.status]
                }}</span
                ><span>下单于 {{ activeOrder.placedAt }}</span>
              </div>
              <p class="demo-scene-meta demo-order-number">订单号 {{ activeOrder.id }}</p>
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
              <p
                v-if="paymentNotes[activeOrder.id]"
                ref="paymentReceipt"
                tabindex="-1"
                role="status"
                class="demo-success-note"
              >
                <NovaIcon name="check" />{{ paymentNotes[activeOrder.id] }}
              </p>
              <p v-else class="demo-scene-meta demo-payment-note">
                {{
                  paying
                    ? '正在确认支付结果，请稍候。'
                    : activeOrder.status === 'pending'
                      ? '请核对商品明细与合计金额后确认支付。'
                      : '当前订单状态与列表同步。'
                }}
              </p>
              <template #footer
                ><div class="demo-order-dialog-footer">
                  <p class="demo-scene-total">
                    <span>合计</span><strong>{{ cny.format(orderTotal(activeOrder)) }}</strong>
                  </p>
                  <div class="demo-dialog-actions">
                    <NovaButton variant="secondary" @click="closeOrder">关闭</NovaButton
                    ><NovaButton
                      v-if="activeOrder.status === 'pending'"
                      variant="primary"
                      :busy="paying"
                      @click="payOrder"
                      >确认支付</NovaButton
                    >
                  </div>
                </div></template
              ></NovaDialog
            >
          </div>
        </NovaTheme>
      </section>
    </div>
  </div>
</template>
