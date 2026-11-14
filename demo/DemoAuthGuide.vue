<script setup lang="ts">
import { computed } from 'vue'
import { NovaButton } from '../src'
import type { AuthMode, NovaLocale } from '../src'
import { DEMO_EMAIL, DEMO_USERNAME, DEMO_PASSWORD, DEMO_NEXT_PASSWORD, demoCode } from './auth'
const props = withDefaults(
  defineProps<{
    busy?: boolean
    mode: AuthMode
    resetStage: 'verify' | 'password'
    identifier?: 'email' | 'username'
    codeLength?: 4 | 6 | null
    locale?: NovaLocale
    fill: (values: {
      email?: string
      password?: string
      confirmPassword?: string
      code?: string
    }) => void
  }>(),
  { identifier: 'email', codeLength: 6, locale: 'zh-CN', busy: false },
)
const english = computed(() => props.locale === 'en-US')
const account = computed(() => (props.identifier === 'username' ? DEMO_USERNAME : DEMO_EMAIL))
const password = computed(() => (props.mode === 'reset' ? DEMO_NEXT_PASSWORD : DEMO_PASSWORD))
const showPassword = computed(
  () =>
    props.mode === 'password' ||
    props.mode === 'register' ||
    (props.mode === 'reset' && props.resetStage === 'password'),
)
const showCode = computed(
  () =>
    props.mode === 'code' ||
    props.mode === 'register' ||
    (props.mode === 'reset' && props.resetStage === 'verify'),
)
const instructions = computed(() => {
  if (props.mode === 'reset' && props.resetStage === 'password')
    return english.value
      ? 'Use the sample new password below. Sign-in credentials stay unchanged in this demo.'
      : '设置新密码时可使用下方示例。重置演示后，登录仍使用原示例密码。'
  if (showCode.value)
    return english.value
      ? 'Request a code and complete verification first, then enter the sample code below. No email is sent.'
      : '先点击获取验证码并完成验证，再填写下方演示码；不会发送真实邮件。'
  return english.value
    ? 'Use this synthetic account to try sign-in. Do not enter real credentials.'
    : '使用示例账号体验登录，请勿填写真实账号或密码。'
})
function fillExample() {
  props.fill({
    ...(props.mode === 'reset' && props.resetStage === 'password' ? {} : { email: account.value }),
    ...(showPassword.value ? { password: password.value, confirmPassword: password.value } : {}),
    ...(showCode.value ? { code: demoCode(props.codeLength) } : {}),
  })
}
</script>
<template>
  <aside class="demo-auth-guide" :aria-label="english ? 'Sample credentials' : '演示填写说明'">
    <div class="demo-auth-guide-heading">
      <strong>{{ english ? 'Sample credentials' : '演示填写说明' }}</strong
      ><NovaButton variant="ghost" :disabled="busy" @click="fillExample">{{
        english ? 'Fill example' : '填入示例'
      }}</NovaButton>
    </div>
    <dl>
      <div v-if="mode !== 'reset' || resetStage !== 'password'">
        <dt>
          {{
            identifier === 'username' ? (english ? 'Username' : '账号') : english ? 'Email' : '邮箱'
          }}
        </dt>
        <dd>
          <code>{{ account }}</code>
        </dd>
      </div>
      <div v-if="showPassword">
        <dt>
          {{
            mode === 'reset' ? (english ? 'New password' : '新密码') : english ? 'Password' : '密码'
          }}
        </dt>
        <dd>
          <code>{{ password }}</code>
        </dd>
      </div>
      <div v-if="showCode">
        <dt>{{ english ? 'Code' : '验证码' }}</dt>
        <dd>
          <code>{{ demoCode(codeLength) }}</code>
        </dd>
      </div>
    </dl>
    <p>{{ instructions }}</p>
  </aside>
</template>
