<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { NovaButton, NovaDialog, NovaField, NovaTheme } from '../src'
import './scene-gallery.css'

/**
 * Composition-only showcase: hosts combine the shipped base components
 * (NovaField / NovaButton / NovaDialog) into their own business scenes.
 * These cards are demo app content, never part of the npm package.
 */

// --- 字段形态 ---
const fields = reactive({
  site: '',
  amount: '',
  phone: '',
  secret: '',
  when: '',
  intro: '预填写的简介内容',
  broken: '已被占用的名称',
  locked: '由服务端下发的值',
})

// --- 任务列表 ---
interface Task {
  id: number
  title: string
  done: boolean
}
let taskSeq = 3
const tasks = ref<Task[]>([
  { id: 1, title: '核对发票', done: false },
  { id: 2, title: '回复客户邮件', done: true },
  { id: 3, title: '整理周报提纲', done: false },
])
const taskQuery = ref('')
const taskFilter = ref<'all' | 'open' | 'done'>('all')
const taskDraft = ref('')
const taskError = ref('')
const taskFilters = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '进行中' },
  { key: 'done', label: '已完成' },
] as const
const visibleTasks = computed(() =>
  tasks.value.filter(
    (task) =>
      (taskFilter.value === 'all' || (taskFilter.value === 'done') === task.done) &&
      task.title.includes(taskQuery.value.trim()),
  ),
)
const doneCount = computed(() => tasks.value.filter((task) => task.done).length)
function addTask() {
  const title = taskDraft.value.trim()
  if (!title) {
    taskError.value = '请输入任务内容。'
    return
  }
  taskError.value = ''
  tasks.value.unshift({ id: ++taskSeq, title, done: false })
  taskDraft.value = ''
}
function toggleTask(task: Task) {
  task.done = !task.done
}
function removeTask(id: number) {
  tasks.value = tasks.value.filter((task) => task.id !== id)
}

// --- 简单编辑器 ---
const post = reactive({ title: '', body: '' })
const postTitleError = ref('')
const postBodyError = ref('')
const postBusy = ref(false)
const postSaved = ref('')
const previewOn = ref(false)
function savePost() {
  if (postBusy.value) return
  postTitleError.value = post.title.trim() ? '' : '标题不能为空。'
  postBodyError.value = post.body.trim() ? '' : '正文不能为空。'
  if (postTitleError.value || postBodyError.value) return
  postBusy.value = true
  window.setTimeout(() => {
    postBusy.value = false
    postSaved.value = `已保存《${post.title.trim()}》到内存（演示，刷新即清空）。`
  }, 700)
}
function clearPost() {
  post.title = ''
  post.body = ''
  postTitleError.value = ''
  postBodyError.value = ''
  postSaved.value = ''
  previewOn.value = false
}
// Host-side pattern: clear a field error as soon as the user edits the field.
watch(
  () => post.title,
  (value) => {
    if (postTitleError.value && value.trim()) postTitleError.value = ''
  },
)
watch(
  () => post.body,
  (value) => {
    if (postBodyError.value && value.trim()) postBodyError.value = ''
  },
)

// --- 评论 ---
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
const avatarColors = ['#6958c5', '#217560', '#956100', '#636172']
const commentDraft = ref('')
const commentError = ref('')
const commentBusy = ref(false)
function publishComment() {
  if (commentBusy.value) return
  const body = commentDraft.value.trim()
  if (!body) {
    commentError.value = '评论内容不能为空。'
    return
  }
  commentError.value = ''
  commentBusy.value = true
  window.setTimeout(() => {
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
  }, 700)
}
function toggleLike(comment: Comment) {
  comment.liked = !comment.liked
  comment.likes += comment.liked ? 1 : -1
}

// --- 订单 ---
type OrderStatus = 'pending' | 'shipped' | 'done'
interface Order {
  id: string
  title: string
  status: OrderStatus
  placedAt: string
  items: { name: string; qty: number; price: number }[]
}
const statusLabels: Record<OrderStatus, string> = {
  pending: '待支付',
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
  { key: 'shipped', label: '已发货' },
  { key: 'done', label: '已完成' },
] as const
const orderFilter = ref<'all' | OrderStatus>('all')
const orderCounts = computed(() => ({
  all: orders.value.length,
  pending: orders.value.filter((order) => order.status === 'pending').length,
  shipped: orders.value.filter((order) => order.status === 'shipped').length,
  done: orders.value.filter((order) => order.status === 'done').length,
}))
const visibleOrders = computed(() =>
  orders.value.filter((order) => orderFilter.value === 'all' || order.status === orderFilter.value),
)
const openOrderId = ref('')
const payNote = ref('')
const paying = ref(false)
const activeOrder = computed(
  () => orders.value.find((order) => order.id === openOrderId.value) ?? null,
)
const cny = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
function orderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.qty * item.price, 0)
}
function openOrder(id: string) {
  openOrderId.value = id
  payNote.value = ''
}
function payOrder() {
  const order = activeOrder.value
  if (!order || paying.value || order.status !== 'pending') return
  paying.value = true
  window.setTimeout(() => {
    order.status = 'shipped'
    paying.value = false
    payNote.value = '演示支付完成：状态已更新为“已发货”。数据仅存在内存。'
  }, 800)
}
</script>
<template>
  <div class="demo-scenes">
    <!-- 字段形态 -->
    <section class="demo-scene-cell" aria-labelledby="scene-fields-title">
      <h2 id="scene-fields-title" class="demo-scene-title">字段形态</h2>
      <NovaTheme>
        <div class="demo-scene-card">
          <div class="demo-scene-fields">
            <NovaField
              v-model="fields.site"
              label="站点地址"
              placeholder="站点名称"
              autocomplete="off"
            >
              <template #prefix
                ><span class="demo-scene-affix" aria-hidden="true">https://</span></template
              >
              <template #suffix
                ><span class="demo-scene-affix" aria-hidden="true">.example</span></template
              >
            </NovaField>
            <NovaField
              v-model="fields.amount"
              label="金额"
              type="number"
              inputmode="decimal"
              min="0"
              placeholder="0.00"
              hint="数字输入配合前缀单位"
            >
              <template #prefix
                ><span class="demo-scene-affix" aria-hidden="true">¥</span></template
              >
            </NovaField>
            <NovaField
              v-model="fields.phone"
              label="手机号"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="13800000000"
            >
              <template #prefix
                ><span class="demo-scene-affix" aria-hidden="true">+86</span></template
              >
            </NovaField>
            <NovaField
              v-model="fields.secret"
              label="密码"
              type="password"
              autocomplete="new-password"
              hint="密码输入不做明文回显"
            />
            <NovaField v-model="fields.when" label="日期" type="date" hint="浏览器原生日期选择器" />
            <NovaField
              v-model="fields.intro"
              as="textarea"
              label="简介"
              :maxlength="60"
              :hint="`已输入 ${fields.intro.length}/60 字符（原生 maxlength 按 UTF-16 code units 计数）`"
            />
            <NovaField
              v-model="fields.broken"
              label="错误态字段"
              error="该名称已被占用（演示文案）"
            />
            <NovaField v-model="fields.locked" label="禁用字段" disabled />
          </div>
          <p class="demo-scene-meta">字段值仅保存在本页内存；长度、格式与业务校验由服务端执行。</p>
        </div>
      </NovaTheme>
    </section>

    <!-- 任务列表 -->
    <section class="demo-scene-cell" aria-labelledby="scene-tasks-title">
      <h2 id="scene-tasks-title" class="demo-scene-title">列表与筛选</h2>
      <NovaTheme>
        <div class="demo-scene-card">
          <NovaField
            v-model="taskQuery"
            label="搜索任务"
            type="search"
            placeholder="按标题过滤"
            autocomplete="off"
          />
          <div role="group" aria-label="任务状态筛选" class="demo-scene-row">
            <button
              v-for="filter in taskFilters"
              :key="filter.key"
              type="button"
              class="demo-scene-chip"
              :aria-pressed="taskFilter === filter.key"
              @click="taskFilter = filter.key"
            >
              {{ filter.label }}
            </button>
          </div>
          <form aria-label="任务添加" class="demo-scene-form" @submit.prevent="addTask">
            <NovaField
              v-model="taskDraft"
              label="新任务"
              placeholder="例如：整理周报提纲"
              autocomplete="off"
              :error="taskError"
            />
            <NovaButton type="submit" variant="primary">添加</NovaButton>
          </form>
          <ul class="demo-scene-list">
            <li v-for="task in visibleTasks" :key="task.id" class="demo-scene-item">
              <label class="demo-scene-grow demo-scene-check">
                <input type="checkbox" :checked="task.done" @change="toggleTask(task)" />
                <span :class="{ 'demo-scene-done': task.done }">{{ task.title }}</span>
              </label>
              <button
                type="button"
                class="demo-scene-chip"
                aria-label="删除任务"
                @click="removeTask(task.id)"
              >
                删除
              </button>
            </li>
            <li v-if="visibleTasks.length === 0" class="demo-scene-empty">
              没有匹配的任务；切换筛选或清空搜索词。
            </li>
          </ul>
          <p class="demo-scene-meta">
            进行中 {{ tasks.length - doneCount }} · 已完成 {{ doneCount }}（数据仅内存）
          </p>
        </div>
      </NovaTheme>
    </section>

    <!-- 简单编辑器 -->
    <section class="demo-scene-cell" aria-labelledby="scene-editor-title">
      <h2 id="scene-editor-title" class="demo-scene-title">简单编辑器</h2>
      <NovaTheme>
        <div class="demo-scene-card">
          <form aria-label="保存文章" class="demo-scene-form" @submit.prevent="savePost">
            <NovaField
              v-model="post.title"
              label="文章标题"
              :maxlength="40"
              autocomplete="off"
              :error="postTitleError"
            />
            <NovaField
              v-model="post.body"
              as="textarea"
              label="正文"
              :maxlength="200"
              :hint="`已输入 ${post.body.length}/200 字符`"
              :error="postBodyError"
            />
            <div class="demo-scene-row">
              <NovaButton type="submit" variant="primary" :busy="postBusy">保存草稿</NovaButton>
              <NovaButton :aria-pressed="previewOn" @click="previewOn = !previewOn"
                >预览</NovaButton
              >
              <NovaButton variant="ghost" @click="clearPost">清空</NovaButton>
            </div>
          </form>
          <div v-if="previewOn" class="demo-scene-preview">
            <p>
              <strong>{{ post.title.trim() || '（无标题）' }}</strong>
            </p>
            <p>{{ post.body.trim() || '（暂无正文）' }}</p>
          </div>
          <p v-if="postSaved" role="status" class="demo-scene-meta">{{ postSaved }}</p>
          <p class="demo-scene-meta">
            富文本编辑器由宿主自行实现；此处演示 maxlength、字数提示与提交忙态的组合。
          </p>
        </div>
      </NovaTheme>
    </section>

    <!-- 评论 -->
    <section class="demo-scene-cell" aria-labelledby="scene-comments-title">
      <h2 id="scene-comments-title" class="demo-scene-title">评论区</h2>
      <NovaTheme>
        <div class="demo-scene-card">
          <form aria-label="发布评论" class="demo-scene-form" @submit.prevent="publishComment">
            <NovaField
              v-model="commentDraft"
              as="textarea"
              label="发表评论"
              :maxlength="120"
              autocomplete="off"
              :hint="`已输入 ${commentDraft.length}/120 字符`"
              :error="commentError"
            />
            <div class="demo-scene-row">
              <NovaButton type="submit" variant="primary" :busy="commentBusy">发布</NovaButton>
              <span class="demo-scene-meta">{{ comments.length }} 条评论</span>
            </div>
          </form>
          <ul class="demo-scene-list">
            <li v-for="comment in comments" :key="comment.id" class="demo-scene-comment">
              <span
                class="demo-scene-avatar"
                :style="{ background: avatarColors[comment.id % avatarColors.length] }"
                aria-hidden="true"
                >{{ comment.author.slice(0, 1) }}</span
              >
              <div class="demo-scene-grow">
                <p class="demo-scene-meta">
                  <strong>{{ comment.author }}</strong> · {{ comment.at }}
                </p>
                <p>{{ comment.body }}</p>
                <button
                  type="button"
                  class="demo-scene-chip"
                  :aria-pressed="comment.liked"
                  aria-label="点赞评论"
                  @click="toggleLike(comment)"
                >
                  赞 {{ comment.likes }}
                </button>
              </div>
            </li>
          </ul>
          <p class="demo-scene-meta">评论数据为虚构合成内容，仅保存在本页内存。</p>
        </div>
      </NovaTheme>
    </section>

    <!-- 订单 -->
    <section class="demo-scene-cell" aria-labelledby="scene-orders-title">
      <h2 id="scene-orders-title" class="demo-scene-title">订单列表</h2>
      <NovaTheme>
        <div class="demo-scene-card">
          <div role="group" aria-label="订单状态筛选" class="demo-scene-row">
            <button
              v-for="filter in orderFilters"
              :key="filter.key"
              type="button"
              class="demo-scene-chip"
              :aria-pressed="orderFilter === filter.key"
              @click="orderFilter = filter.key"
            >
              {{ filter.label }}（{{ orderCounts[filter.key] }}）
            </button>
          </div>
          <ul class="demo-scene-list">
            <li v-for="order in visibleOrders" :key="order.id" class="demo-scene-item">
              <div class="demo-scene-grow">
                <p>{{ order.title }}</p>
                <p class="demo-scene-meta">{{ order.id }} · {{ order.placedAt }}</p>
              </div>
              <span class="demo-scene-status" :data-status="order.status">{{
                statusLabels[order.status]
              }}</span>
              <button
                type="button"
                class="demo-scene-chip"
                :aria-label="`查看订单 ${order.id}`"
                @click="openOrder(order.id)"
              >
                详情
              </button>
            </li>
            <li v-if="visibleOrders.length === 0" class="demo-scene-empty">该状态下暂无订单。</li>
          </ul>
          <p class="demo-scene-meta">订单与支付均为内存模拟；真实支付、发货与退款由服务端执行。</p>
          <!-- 对话框留在 NovaTheme 根内，避免丢失主题 token。 -->
          <NovaDialog
            v-if="activeOrder"
            :open="true"
            :title="`订单详情 ${activeOrder.id}`"
            @close="openOrderId = ''"
          >
            <p class="demo-scene-meta">
              {{ activeOrder.title }} · 下单于 {{ activeOrder.placedAt }}
            </p>
            <table class="demo-scene-table">
              <thead>
                <tr>
                  <th scope="col">品名</th>
                  <th scope="col">数量</th>
                  <th scope="col">单价</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in activeOrder.items" :key="item.name">
                  <td>{{ item.name }}</td>
                  <td>× {{ item.qty }}</td>
                  <td>{{ cny.format(item.price) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="demo-scene-total">
              <span>合计</span><span>{{ cny.format(orderTotal(activeOrder)) }}</span>
            </p>
            <p>
              状态：<span class="demo-scene-status" :data-status="activeOrder.status">{{
                statusLabels[activeOrder.status]
              }}</span>
            </p>
            <p v-if="payNote" role="status" class="demo-scene-meta">{{ payNote }}</p>
            <template #footer>
              <div class="demo-scene-row">
                <NovaButton
                  v-if="activeOrder.status === 'pending'"
                  variant="primary"
                  :busy="paying"
                  @click="payOrder"
                  >模拟支付</NovaButton
                >
                <NovaButton variant="ghost" @click="openOrderId = ''">关闭</NovaButton>
              </div>
            </template>
          </NovaDialog>
        </div>
      </NovaTheme>
    </section>
  </div>
</template>
