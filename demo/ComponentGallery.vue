<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import { NovaButton, NovaDialog, NovaField, NovaTheme } from '../src'
import type { Appearance } from '../src'
import NovaIcon from '../src/components/NovaIcon.vue'

const props = withDefaults(defineProps<{ appearance: Appearance; active?: boolean }>(), {
  active: true,
})
const formId = useId()
const activeComponent = defineModel<string>('activeComponent', { default: 'fields' })
const fields = reactive({
  site: '',
  amount: '',
  phone: '',
  secret: '',
  when: '',
  intro: '你好，我喜欢把复杂的问题整理得简单一点。',
  broken: 'nova',
  locked: '由服务端下发的值',
  readonly: 'demo@nova.example',
})
const nameError = ref('该名称已被使用，请换一个。')
const nameNote = ref('')
watch(
  () => fields.broken,
  () => {
    nameError.value = ''
    nameNote.value = ''
  },
)
function checkName() {
  nameNote.value = ''
  if (!fields.broken.trim()) nameError.value = '请输入你想使用的名称。'
  else if (fields.broken.trim().toLowerCase() === 'nova')
    nameError.value = '该名称已被使用，请换一个。'
  else {
    nameError.value = ''
    nameNote.value = '这个名称可以使用（演示）。'
  }
}
const actionBusy = ref(false)
const actionNote = ref('')
let actionTimer: ReturnType<typeof setTimeout> | undefined
function runAction() {
  if (actionBusy.value) return
  actionBusy.value = true
  actionNote.value = ''
  actionTimer = setTimeout(() => {
    actionBusy.value = false
    actionNote.value = '操作完成，可以再次体验。'
  }, 900)
}
onBeforeUnmount(() => clearTimeout(actionTimer))
const dialogOpen = ref(false)
watch([() => props.active, activeComponent], ([active, component]) => {
  if (!active || component !== 'dialogs') dialogOpen.value = false
})
const dialogKind = ref<'confirm' | 'form' | 'long'>('confirm')
const dialogNote = ref('')
const displayName = ref('Nova 演示用户')
const nameDraft = ref('')
const dialogError = ref('')
const dialogTitle = computed(() =>
  dialogKind.value === 'form'
    ? '编辑显示名称'
    : dialogKind.value === 'long'
      ? '内容较多时，依然清晰'
      : '确认保存更改？',
)
function openDialog(kind: 'confirm' | 'form' | 'long') {
  dialogKind.value = kind
  dialogError.value = ''
  nameDraft.value = displayName.value
  dialogOpen.value = true
}
function confirmDialog(event?: Event) {
  if (dialogKind.value === 'form') {
    if (!nameDraft.value.trim()) {
      dialogError.value = '请输入显示名称。'
      const form = event?.currentTarget as HTMLFormElement | null
      void nextTick(() => form?.querySelector<HTMLInputElement>('input')?.focus())
      return
    }
    displayName.value = nameDraft.value.trim()
    dialogNote.value = `显示名称已更新为「${displayName.value}」。`
  } else
    dialogNote.value = dialogKind.value === 'long' ? '已阅读示例内容。' : '更改已确认（演示）。'
  dialogOpen.value = false
}
watch(nameDraft, (value) => {
  if (value.trim()) dialogError.value = ''
})
</script>
<template>
  <div class="demo-showcase demo-component-page">
    <NovaTheme :model-value="appearance">
      <section
        v-show="activeComponent === 'fields'"
        class="demo-component-section demo-fields-workspace"
        aria-label="输入字段示例"
      >
        <div class="demo-panel">
          <div class="demo-panel-heading">
            <div>
              <h2>常用输入</h2>
              <p>前后缀与输入内容保持在同一控件内。</p>
            </div>
            <code>NovaField</code>
          </div>
          <div class="demo-field-grid">
            <NovaField
              v-model="fields.site"
              label="站点地址"
              placeholder="my-workspace"
              autocomplete="off"
              ><template #prefix><span class="demo-scene-affix">https://</span></template
              ><template #suffix
                ><span class="demo-scene-affix">.example</span></template
              ></NovaField
            >
            <NovaField
              v-model="fields.amount"
              label="金额"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              hint="支持小数金额"
              ><template #prefix><span class="demo-scene-affix">¥</span></template></NovaField
            >
            <NovaField
              v-model="fields.phone"
              label="手机号"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="13800000000"
              ><template #prefix><span class="demo-scene-affix">+86</span></template></NovaField
            >
            <NovaField
              v-model="fields.secret"
              label="密码"
              type="password"
              autocomplete="new-password"
              placeholder="输入密码"
            />
            <NovaField v-model="fields.when" label="日期" type="date" />
            <NovaField
              v-model="fields.readonly"
              label="只读邮箱"
              readonly
              hint="可以选择与复制，无法编辑"
            />
          </div>
        </div>
        <div class="demo-panel">
          <div class="demo-panel-heading">
            <div>
              <h2>多行文本</h2>
              <p>为较长的内容留出合适的书写空间。</p>
            </div>
          </div>
          <NovaField
            v-model="fields.intro"
            as="textarea"
            label="简介"
            :rows="4"
            :maxlength="60"
            :hint="`已输入 ${fields.intro.length}/60 字符`"
            placeholder="用一两句话介绍自己"
          />
        </div>
        <div class="demo-panel">
          <div class="demo-panel-heading">
            <div>
              <h2>校验与状态</h2>
              <p>输入时清除旧错误，提交时给出明确反馈。</p>
            </div>
          </div>
          <div class="demo-field-grid">
            <div class="demo-field-validation">
              <NovaField
                v-model="fields.broken"
                label="错误态字段"
                :maxlength="24"
                :error="nameError"
                hint="试着换一个名称，再点击验证。"
              /><NovaButton @click="checkName">验证名称</NovaButton>
              <p v-if="nameNote" role="status" class="demo-success-note">{{ nameNote }}</p>
            </div>
            <NovaField
              v-model="fields.locked"
              label="禁用字段"
              disabled
              hint="不可编辑，也不会进入键盘焦点顺序"
            />
          </div>
        </div>
        <details class="demo-usage">
          <summary>NovaField · 用法与属性</summary>
          <div class="demo-usage-body">
            <pre><code>&lt;NovaField v-model="value" label="显示名称"
  :maxlength="24" :error="error" hint="给自己起个名字" /&gt;</code></pre>
            <p>
              支持 input / textarea、原生输入属性、prefix / suffix 插槽。错误与业务校验由宿主传入。
            </p>
            <p>示例输入仅保存在当前页面，刷新后重置。</p>
          </div>
        </details>
      </section>

      <section
        v-show="activeComponent === 'buttons'"
        class="demo-component-section demo-buttons-workspace"
        aria-label="按钮预览"
      >
        <div class="demo-panel demo-button-specimens">
          <div class="demo-panel-heading">
            <div>
              <h2>操作层级</h2>
              <p>同一组操作，只突出最重要的一项。</p>
            </div>
            <code>NovaButton</code>
          </div>
          <div class="demo-specimen-row">
            <div>
              <h3>主要操作 <code>primary</code></h3>
              <p>提交、保存与确认</p>
            </div>
            <NovaButton variant="primary" @click="actionNote = '已触发主要操作。'"
              >主要操作</NovaButton
            >
          </div>
          <div class="demo-specimen-row">
            <div>
              <h3>默认操作 <code>secondary</code></h3>
              <p>并列的次要选择</p>
            </div>
            <NovaButton @click="actionNote = '已触发默认操作。'">默认操作</NovaButton>
          </div>
          <div class="demo-specimen-row">
            <div>
              <h3>轻量操作 <code>ghost</code></h3>
              <p>取消、返回与辅助入口</p>
            </div>
            <NovaButton variant="ghost" @click="actionNote = '已触发幽灵操作。'"
              >幽灵操作</NovaButton
            >
          </div>
        </div>
        <div class="demo-button-controls">
          <div class="demo-panel">
            <div class="demo-panel-heading">
              <div>
                <h2>状态与图标</h2>
                <p>加载时阻止重复提交，禁用时保留清晰的含义。</p>
              </div>
            </div>
            <div class="demo-button-state-row">
              <div>
                <NovaButton variant="primary" :busy="actionBusy" @click="runAction">{{
                  actionBusy ? '正在提交' : '体验加载状态'
                }}</NovaButton>
                <p>{{ actionBusy ? '当前操作处理中' : '点击体验一次 0.9 秒的异步操作' }}</p>
              </div>
              <div>
                <NovaButton disabled>禁用操作</NovaButton>
                <p>条件未满足，暂不可用</p>
              </div>
              <div>
                <NovaButton @click="actionNote = '已触发带图标的添加操作。'"
                  ><NovaIcon name="plus" />添加项目</NovaButton
                >
                <p>图标辅助表达操作含义</p>
              </div>
            </div>
          </div>
          <div class="demo-component-feedback" role="status">
            <NovaIcon v-if="actionNote" name="check" />{{
              actionNote || '点击任意可用按钮，操作结果会显示在这里。'
            }}
          </div>
        </div>
        <details class="demo-usage">
          <summary>NovaButton · 用法与属性</summary>
          <div class="demo-usage-body">
            <pre><code>&lt;NovaButton variant="primary" :busy="saving" @click="save"&gt;
  保存更改
&lt;/NovaButton&gt;</code></pre>
            <p>支持 primary / secondary / ghost 三种样式，以及 type、busy、disabled 属性。</p>
          </div>
        </details>
      </section>

      <section
        v-show="activeComponent === 'dialogs'"
        class="demo-component-section demo-dialogs-workspace"
        aria-label="对话框预览"
      >
        <div class="demo-panel">
          <div class="demo-panel-heading">
            <div>
              <h2>选择一种交互来体验</h2>
              <p>沿用当前主题，按 Esc 关闭后，焦点会回到打开按钮。</p>
            </div>
            <code>NovaDialog</code>
          </div>
          <div class="demo-dialog-example">
            <span class="demo-example-icon"><NovaIcon name="check" /></span>
            <div>
              <h3>确认操作</h3>
              <p>简洁说明将要发生的事，提供确认与返回。</p>
            </div>
            <NovaButton variant="primary" @click="openDialog('confirm')">打开示例对话框</NovaButton>
          </div>
          <div class="demo-dialog-example">
            <span class="demo-example-icon"><NovaIcon name="profile" /></span>
            <div>
              <h3>表单编辑</h3>
              <p>当前名称：{{ displayName }}</p>
            </div>
            <NovaButton @click="openDialog('form')">打开表单对话框</NovaButton>
          </div>
          <div class="demo-dialog-example">
            <span class="demo-example-icon"><NovaIcon name="document" /></span>
            <div>
              <h3>长内容阅读</h3>
              <p>内容超出屏幕时，在弹窗内自然滚动。</p>
            </div>
            <NovaButton @click="openDialog('long')">打开长内容对话框</NovaButton>
          </div>
        </div>
        <aside class="demo-panel demo-dialog-capabilities">
          <div class="demo-panel-heading">
            <div>
              <h2>交互与当前状态</h2>
              <p>在左侧选择一种场景，实际打开对话框。</p>
            </div>
            <NovaIcon name="dialogs" />
          </div>
          <dl>
            <div>
              <dt>键盘</dt>
              <dd>Tab 在弹窗内移动，Esc 关闭</dd>
            </div>
            <div>
              <dt>关闭后</dt>
              <dd>焦点回到刚才的打开按钮</dd>
            </div>
            <div>
              <dt>表单名称</dt>
              <dd>{{ displayName }}</dd>
            </div>
            <div>
              <dt>长内容</dt>
              <dd>根据当前窗口高度，在内部滚动</dd>
            </div>
          </dl>
          <div role="status" class="demo-component-feedback">
            <NovaIcon v-if="dialogNote" name="check" />{{
              dialogNote || '选择上面的示例，体验打开、确认与关闭。'
            }}
          </div>
        </aside>
        <details class="demo-usage">
          <summary>NovaDialog · 用法与属性</summary>
          <div class="demo-usage-body">
            <pre><code>&lt;NovaDialog :open="open" title="确认保存？" @close="open = false"&gt;
  &lt;p&gt;确认后保存当前修改。&lt;/p&gt;
  &lt;template #footer&gt;…&lt;/template&gt;
&lt;/NovaDialog&gt;</code></pre>
            <p>使用原生 dialog 管理焦点与模态。保持在 NovaTheme 内即可继承主题。</p>
          </div>
        </details>
      </section>
      <NovaDialog :open="dialogOpen" :title="dialogTitle" @close="dialogOpen = false">
        <form
          v-if="dialogKind === 'form'"
          :id="formId"
          class="demo-scene-form"
          @submit.prevent="confirmDialog"
        >
          <NovaField
            v-model="nameDraft"
            label="显示名称"
            :maxlength="24"
            :error="dialogError"
            hint="名称仅用于当前演示"
          />
        </form>
        <div v-else-if="dialogKind === 'long'" class="demo-long-dialog">
          <p>
            对话框适合在当前页面上完成一件明确的事。内容较长时，应保持标题清晰，让阅读与操作都有足够空间。
          </p>
          <h3>内容如何组织</h3>
          <p>把相关信息放在一起，每段只表达一个重点。优先使用简短的段落，必要时再展开更多说明。</p>
          <h3>键盘如何操作</h3>
          <p>
            使用 Tab 在可操作元素之间移动。按 Esc 可以关闭对话框，关闭后，焦点会回到刚才的打开按钮。
          </p>
          <h3>在小屏幕上</h3>
          <p>弹窗宽度跟随屏幕，较长的内容在内部滚动。关闭和确认操作始终保留清晰的文字标签。</p>
          <h3>演示数据</h3>
          <p>
            这个页面使用本地模拟数据，不会提交到真实服务。所有修改仅在本页内存中保留，刷新后重置。
          </p>
        </div>
        <div v-else class="demo-confirm-body">
          <span class="demo-confirm-icon"><NovaIcon name="document" /></span>
          <p>当前的演示设置将保存到本页内存，你可以继续浏览其他账户页面。</p>
          <dl>
            <div>
              <dt>保存位置</dt>
              <dd>当前演示页面</dd>
            </div>
            <div>
              <dt>数据保留</dt>
              <dd>刷新页面后重置</dd>
            </div>
          </dl>
        </div>
        <template #footer
          ><div class="demo-dialog-actions">
            <NovaButton @click="dialogOpen = false">取消</NovaButton
            ><NovaButton v-if="dialogKind === 'form'" type="submit" :form="formId" variant="primary"
              >保存名称</NovaButton
            ><NovaButton v-else variant="primary" @click="confirmDialog">{{
              dialogKind === 'long' ? '我知道了' : '确认保存'
            }}</NovaButton>
          </div></template
        >
      </NovaDialog>
    </NovaTheme>
  </div>
</template>
