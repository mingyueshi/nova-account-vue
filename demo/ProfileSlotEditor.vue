<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { NovaButton, NovaField } from '../src'
import type { AccountAdapter, AccountSnapshot, MutationContext } from '../src'
import './scene-gallery.css'

/** Rich profile page rendered through the demo's #profile slot. Core fields go through the
 *  adapter contract; extended fields live in this page's memory only (the typed AccountSnapshot
 *  contract does not carry them). */
const props = defineProps<{
  snapshot: AccountSnapshot
  adapter: AccountAdapter
  refresh: () => Promise<AccountSnapshot | undefined>
}>()

const core = reactive({
  nickname: props.snapshot.profile.nickname,
  bio: props.snapshot.profile.bio,
})
const coreDirty = computed(
  () =>
    core.nickname !== props.snapshot.profile.nickname || core.bio !== props.snapshot.profile.bio,
)
const coreErrors = reactive({ nickname: '' })
const saving = ref(false)
const note = ref('')

watch(
  () => core.nickname,
  (value) => {
    if (coreErrors.nickname && value.trim()) coreErrors.nickname = ''
  },
)

function mutationContext(): MutationContext {
  return {
    signal: new AbortController().signal,
    requestId: `profile-slot-${Date.now()}`,
    revision: props.snapshot.revision,
  }
}
async function saveProfile() {
  if (saving.value) return
  coreErrors.nickname = core.nickname.trim() ? '' : '昵称不能为空。'
  extrasErrors.phone = /^1\d{10}$/.test(extras.phone.trim())
    ? ''
    : '手机号格式应为 1 开头的 11 位数字。'
  extrasErrors.site =
    !extras.site.trim() || /^[\w-]+(\.[\w-]+)+$/.test(extras.site.trim())
      ? ''
      : '请输入有效的主页域名，例如 nova.example。'
  if (coreErrors.nickname || extrasErrors.phone || extrasErrors.site) return
  saving.value = true
  note.value = ''
  try {
    await props.adapter.updateProfile(
      {
        nickname: core.nickname.trim(),
        bio: core.bio,
        avatar: props.snapshot.profile.avatar,
        avatarUrl: props.snapshot.profile.avatarUrl,
      },
      mutationContext(),
    )
    await props.refresh()
    note.value = '核心资料已通过适配器保存；扩展字段仅保留在本页内存。'
  } catch (cause) {
    note.value = cause instanceof Error ? cause.message : '保存失败，请重试。'
  } finally {
    saving.value = false
  }
}
function resetCore() {
  core.nickname = props.snapshot.profile.nickname
  core.bio = props.snapshot.profile.bio
  coreErrors.nickname = ''
  note.value = ''
}

// --- 头像上传（经适配器 uploadAvatar 能力） ---
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const avatarBusy = ref(false)
const avatarError = ref('')
const avatarDataUrl = computed(() => props.snapshot.profile.avatarUrl || '')
async function pushAvatar(dataUrl: string | null) {
  if (!props.adapter.uploadAvatar) return
  try {
    await props.adapter.uploadAvatar({ dataUrl }, mutationContext())
    await props.refresh()
    avatarError.value = ''
  } catch (cause) {
    avatarError.value = cause instanceof Error ? cause.message : '上传失败，请重试。'
  }
}
function onAvatarFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || avatarBusy.value) return
  if (!file.type.startsWith('image/')) {
    avatarError.value = '仅支持图片文件（演示校验，服务端同样必须校验）。'
    return
  }
  if (file.size > MAX_AVATAR_BYTES) {
    avatarError.value = '图片不能超过 2 MB（演示校验）。'
    return
  }
  avatarBusy.value = true
  avatarError.value = ''
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      await pushAvatar(String(reader.result))
    } finally {
      avatarBusy.value = false
    }
  }
  reader.onerror = () => {
    avatarBusy.value = false
    avatarError.value = '读取文件失败，请重试。'
  }
  reader.readAsDataURL(file)
}
async function removeAvatar() {
  if (avatarBusy.value) return
  avatarBusy.value = true
  try {
    await pushAvatar(null)
  } finally {
    avatarBusy.value = false
  }
}

// --- 扩展字段（仅本页内存） ---
const extras = reactive({
  job: 'engineer',
  gender: 'secret' as 'secret' | 'female' | 'male',
  birthday: '',
  phone: '13800000000',
  site: '',
})
const extrasErrors = reactive({ phone: '', site: '' })
const profileJobs = [
  { value: 'engineer', label: '工程师' },
  { value: 'designer', label: '设计师' },
  { value: 'product', label: '产品经理' },
  { value: 'operations', label: '运营' },
  { value: 'other', label: '其他' },
]
watch(
  () => extras.phone,
  (value) => {
    if (extrasErrors.phone && value.trim()) extrasErrors.phone = ''
  },
)
watch(
  () => extras.site,
  (value) => {
    if (extrasErrors.site && value.trim()) extrasErrors.site = ''
  },
)
const profileTags = ref(['演示', '组件库'])
const tagDraft = ref('')
const tagError = ref('')
function addTag() {
  const tag = tagDraft.value.trim()
  if (!tag) {
    tagError.value = '标签不能为空。'
    return
  }
  if (profileTags.value.includes(tag)) {
    tagError.value = '标签已存在。'
    return
  }
  if (profileTags.value.length >= 5) {
    tagError.value = '最多 5 个标签。'
    return
  }
  tagError.value = ''
  profileTags.value.push(tag)
  tagDraft.value = ''
}
function removeTag(tag: string) {
  profileTags.value = profileTags.value.filter((item) => item !== tag)
}
</script>
<template>
  <form class="na:space-y-5" @submit.prevent="saveProfile">
    <section class="demo-scene-panel">
      <div class="demo-scene-row">
        <img
          v-if="avatarDataUrl"
          :src="avatarDataUrl"
          alt="当前头像"
          class="demo-scene-avatar-img"
        />
        <span v-else class="demo-scene-avatar demo-scene-avatar-lg" aria-hidden="true">{{
          snapshot.profile.nickname.slice(0, 1).toUpperCase()
        }}</span>
        <div class="demo-scene-grow">
          <label class="demo-scene-chip demo-scene-file">
            {{ avatarBusy ? '上传中…' : '上传头像' }}
            <input
              type="file"
              accept="image/*"
              class="demo-scene-sr-input"
              @change="onAvatarFile"
            />
          </label>
          <NovaButton
            v-if="avatarDataUrl"
            variant="ghost"
            :disabled="avatarBusy"
            @click="removeAvatar"
            >移除头像</NovaButton
          >
        </div>
      </div>
      <p v-if="avatarError" role="alert" class="demo-scene-meta">{{ avatarError }}</p>
      <p class="demo-scene-meta">
        头像经适配器的 uploadAvatar 能力保存（类型 / ≤ 2 MB 由适配器校验）；数据仅保存在本页内存。
      </p>
    </section>
    <section class="demo-scene-panel">
      <div class="demo-scene-fields">
        <NovaField
          v-model="core.nickname"
          label="展示昵称"
          :maxlength="24"
          autocomplete="nickname"
          :hint="`已输入 ${core.nickname.length}/24 字符`"
          :error="coreErrors.nickname"
        />
        <NovaField
          v-model="extras.site"
          label="个人主页"
          autocomplete="off"
          :error="extrasErrors.site"
        >
          <template #prefix
            ><span class="demo-scene-affix" aria-hidden="true">https://</span></template
          >
        </NovaField>
        <NovaField
          v-model="extras.phone"
          label="联系电话"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          :error="extrasErrors.phone"
        />
        <NovaField v-model="extras.birthday" label="生日" type="date" hint="浏览器原生日期选择器" />
        <div class="demo-scene-field">
          <label class="demo-scene-label" for="profile-slot-job">职位</label>
          <select id="profile-slot-job" v-model="extras.job" class="demo-scene-select">
            <option v-for="job in profileJobs" :key="job.value" :value="job.value">
              {{ job.label }}
            </option>
          </select>
        </div>
        <div class="demo-scene-field" role="radiogroup" aria-label="性别">
          <span class="demo-scene-label">性别</span>
          <div class="demo-scene-row">
            <label
              v-for="g in [
                { value: 'secret', label: '保密' },
                { value: 'female', label: '女' },
                { value: 'male', label: '男' },
              ]"
              :key="g.value"
              class="demo-scene-check"
              ><input
                v-model="extras.gender"
                type="radio"
                name="profile-slot-gender"
                :value="g.value"
              />
              {{ g.label }}</label
            >
          </div>
        </div>
        <NovaField
          :model-value="snapshot.profile.id"
          label="用户 ID"
          disabled
          hint="服务端下发，不可修改"
        />
      </div>
      <NovaField
        v-model="core.bio"
        as="textarea"
        label="简介"
        :maxlength="120"
        :hint="`已输入 ${core.bio.length}/120 字符`"
      ></NovaField>
      <div class="demo-scene-field">
        <span class="demo-scene-label">兴趣标签（最多 5 个）</span>
        <div class="demo-scene-row">
          <span v-for="tag in profileTags" :key="tag" class="demo-scene-tag">
            {{ tag }}
            <button
              type="button"
              class="demo-scene-tag-x"
              :aria-label="`移除标签 ${tag}`"
              @click="removeTag(tag)"
            >
              ×
            </button>
          </span>
        </div>
        <div class="demo-scene-row">
          <input
            v-model="tagDraft"
            class="demo-scene-input"
            placeholder="添加标签后回车或点击添加"
            aria-label="新标签名称"
            @keydown.enter.prevent="addTag"
          />
          <NovaButton type="button" @click="addTag">添加标签</NovaButton>
        </div>
        <p v-if="tagError" role="alert" class="demo-scene-meta">{{ tagError }}</p>
      </div>
      <p class="demo-scene-meta">
        昵称与简介经适配器契约保存；职位、电话、标签等扩展字段仅保存在本页内存，真实接入由宿主扩展契约。
      </p>
    </section>
    <div class="demo-scene-row">
      <NovaButton type="submit" variant="primary" :busy="saving">保存资料</NovaButton>
      <NovaButton :disabled="saving || !coreDirty" @click="resetCore">还原</NovaButton>
      <span v-if="coreDirty" class="demo-scene-chip demo-scene-chip-static">有未保存的更改</span>
    </div>
    <p v-if="note" role="status" class="demo-scene-meta">{{ note }}</p>
  </form>
</template>
