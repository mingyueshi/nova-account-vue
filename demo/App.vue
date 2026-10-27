<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue'
import { NovaAccount, NovaAppearance, NovaButton, NovaDialog, NovaError } from '../src'
import type { NovaAdapter } from '../src'
import { createDemoAuthAdapter, defaultSettings, demoUser, DEMO_CODE, DEMO_EMAIL, DEMO_PASSWORD } from './auth'
import { createDemoAccountAdapter, DEMO_ACCOUNT_VALUES } from './account'
import './demo.css'
const settings = reactive(defaultSettings())
const signedIn = ref(false)
const toolsOpen = ref(false)
const panel = ref<'tools' | 'appearance' | 'settings' | 'about'>('tools')
const account = ref<InstanceType<typeof NovaAccount>>()
function createAdapter(): NovaAdapter {
  return {
    simulated: true,
    auth: createDemoAuthAdapter({ settings: () => settings }),
    account: createDemoAccountAdapter({ wait: async signal => {
      const config = { ...settings }
      await new Promise(resolve => setTimeout(resolve, config.network === 'slow' ? 3000 : 350))
      if (signal.aborted) throw new NovaError('CANCELLED', '操作已取消。')
      if (config.network === 'offline') throw new NovaError('NETWORK', '模拟网络不可用，请在体验工具恢复正常后重试。')
      if (config.auth === 'fail') throw new NovaError('REJECTED', '模拟请求被拒绝，状态未改变。')
    } }),
  }
}
const adapter = shallowRef(createAdapter())
function fill() { toolsOpen.value = false; account.value?.fill({ email: DEMO_EMAIL, password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD, code: DEMO_CODE }) }
function preview() { toolsOpen.value = false; account.value?.preview(demoUser()); signedIn.value = true }
function resetDemo() { signedIn.value = false; adapter.value = createAdapter() }
function openTools() { panel.value = 'tools'; toolsOpen.value = true }
</script>
<template>
  <NovaAccount ref="account" class="nova-demo" :class="signedIn ? 'demo-account' : 'demo-auth'" :adapter="adapter" storage-key="nova-appearance-v1" @authenticated="signedIn = true" @logout="resetDemo">
    <template #tools="theme">
      <NovaButton variant="ghost" @click="openTools">体验工具 <span aria-hidden="true">↗</span></NovaButton>
      <NovaDialog :open="toolsOpen" :title="panel === 'appearance' ? '外观设置' : panel === 'settings' ? '演示设置' : panel === 'about' ? '关于这份组件库' : '体验工具'" @close="toolsOpen = false">
        <div v-if="panel === 'tools'" class="demo-stack">
          <NovaButton variant="primary" @click="fill">一键填入示例</NovaButton>
          <NovaButton @click="preview">用户中心预览</NovaButton>
          <NovaButton @click="panel = 'appearance'">外观设置</NovaButton>
          <NovaButton @click="panel = 'settings'">演示设置</NovaButton>
          <NovaButton @click="panel = 'about'">组件库与隐私说明</NovaButton>
          <p class="demo-note">全部账户、设备与消息均为虚构。快捷预览不代表身份认证。</p>
        </div>
        <NovaAppearance v-else-if="panel === 'appearance'" :model-value="theme.appearance" :storage-error="theme.storageError" @update:model-value="theme.setAppearance" />
        <div v-else-if="panel === 'settings'" class="demo-stack">
          <label>网络响应<select v-model="settings.network"><option value="normal">正常</option><option value="slow">慢速 · 3 秒</option><option value="offline">断网</option></select></label>
          <label>滑块结果<select v-model="settings.captcha"><option value="normal">正常</option><option value="fail">验证失败</option><option value="expired">已过期</option></select></label>
          <label>邮箱验证码<select v-model="settings.code"><option value="normal">正常有效</option><option value="expired">已过期</option></select></label>
          <label>业务请求<select v-model="settings.auth"><option value="normal">正常</option><option value="fail">拒绝请求</option></select></label>
          <p class="demo-note">设置仅作用于本页模拟。真实服务端状态不受影响。</p>
          <NovaButton @click="Object.assign(settings, defaultSettings())">恢复正常</NovaButton>
        </div>
        <div v-else class="demo-stack">
          <p>原生 Vue 3 + TypeScript 组件库开发预览，布局与状态由 Vue 响应式组件实现，样式使用命名前缀隔离的 Tailwind 工具类。</p>
          <p>所有业务能力通过接口适配器显式注入。此页面单独加载内存模拟适配器，不发邮件、不创建真实账户、不提供实际安全保护。</p>
          <p>仅明暗模式与品牌色可保存在此浏览器；密码、验证码、资料、设备、消息与安全状态都不持久化。刷新或退出即重置。</p>
          <p>真实账户接口、两站接入、npm 发布均未实施。滑块百分比不是安全证明，服务端须执行挑战校验、限流、会话与权限控制。</p>
        </div>
        <template v-if="panel !== 'tools'" #footer><NovaButton variant="ghost" @click="panel = 'tools'">← 返回工具</NovaButton></template>
      </NovaDialog>
    </template>
    <template #securityFormTools="{ fill: fillSecurity }"><NovaButton variant="ghost" @click="fillSecurity(DEMO_ACCOUNT_VALUES)">填入示例</NovaButton></template>
    <template #footer><span v-if="signedIn">交互演示 · 请勿输入真实资料</span></template>
  </NovaAccount>
</template>
