<script setup lang="ts">
import { ref } from 'vue'
import { NovaAuthForm, NovaButton, NovaError, NovaTheme, type Appearance, type AuthAdapter } from 'nova-account'

// Create adapter state per setup/request; never export a module-level user/session singleton.
// Explicit fail-closed example: replace these methods with the application's authenticated transport.
const notConfigured = async (): Promise<never> => {
  throw new NovaError('ADAPTER_NOT_CONFIGURED', '示例未配置真实账户接口。请先接入服务端适配器。')
}
const adapter: AuthAdapter = {
  challenge: notConfigured, verifyCaptcha: notConfigured, sendCode: notConfigured,
  login: notConfigured, register: notConfigured, verifyResetCode: notConfigured,
  resetPassword: notConfigured, logout: notConfigured,
}
const appearance = ref<Appearance>({ mode: 'light', accent: 'iris' })
</script>

<template>
  <main>
    <header class="host-header"><h1>Nova Nuxt integration</h1><p>宿主页面样式不被组件的 Preflight 重置。</p></header>
    <NovaTheme v-model="appearance">
      <div class="account-example">
        <NovaButton variant="ghost" @click="appearance.mode = appearance.mode === 'dark' ? 'light' : 'dark'">切换显示模式</NovaButton>
        <NovaAuthForm :adapter="adapter">
          <template #footer>接入示例 · 尚未配置真实账户服务</template>
        </NovaAuthForm>
      </div>
    </NovaTheme>
  </main>
</template>

<style scoped>
.host-header { max-width: 56rem; margin: 2rem auto; padding: 0 1rem; }
.account-example { max-width: 56rem; margin: 0 auto; padding: 1rem; }
</style>
