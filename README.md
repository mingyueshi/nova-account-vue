# Nova Account · Vue 组件库开发版

**状态：`0.1.0-dev.1`，可复用组件库的开发交付，不是生产认证系统。**

[English](README.en.md) · [MIT 许可证](LICENSE) · [更新与升级策略](CHANGELOG.md)

由已认可的 Nova Account 交互原型重新实现为原生 **Vue 3 + TypeScript SFC + Tailwind CSS 4**。不是 iframe、HTML 字符串包装或旧脚本容器。认证流程、账户状态、展示组件与业务接口适配器分层；独立演示使用内存 mock，mock 不进入库包。

官方源码仓库：[mingyueshi/nova-account-vue](https://github.com/mingyueshi/nova-account-vue)。[公开交互演示](https://nova-account.mingyueshi.chatgpt.site)由独立托管流程管理；本次入库不触发部署。尚未发布 npm，也未接入 Hen / CSGO 真实账户或变更两站。

## 内容

- 简洁居中认证；密码登录按需滑块；邮箱发码先验证，注册、码登录及重置提交不重复滑块。
- 全屏账户外壳、响应式侧栏/移动导航；资料、消息、设备、偏好、外观与安全展示。
- 资料/偏好保存与取消、未保存离页保护；消息详情/未读；设备确认；模拟敏感操作及活动。
- 浅色 / 深色 / 跟随系统，紫 / 蓝 / 绿 / 琥珀；主题作用于组件根，不修改 `html/body`。
- 显式 adapter props、TypeScript 接口、typed events/slots；可单独使用组件或使用 `NovaAccount` 外壳。
- ESM、Vue peer dependency/external、自包含声明文件、独立预编译 CSS 导出。
- Nuxt 3/4 无 `ClientOnly` 的真实 tarball 接入示例及 SSR smoke。

## 开发

本轮本机验证环境 Node `24.21.0` / npm `11.19.0`；同时检查最低 Node `22.12.0`。锁文件固定依赖；仓库不包含 `.npmrc`、凭据、缓存、依赖目录或构建产物。

```sh
git clone https://github.com/mingyueshi/nova-account-vue.git
cd nova-account-vue
npm ci
npm run check           # lint + format + strict types + coverage + builds + gzip budgets
npm run verify:package  # pack、独立consumer安装、ESM/CSS/Node SSR/严格TS
npm run verify:nuxt     # Nuxt 3/4 真实tarball + typecheck/build/SSR smoke
npx playwright install chromium firefox webkit
npm run test:e2e        # 临时loopback演示站；交互、键盘、视口、axe与主题截图
npm run dev            # Vite演示开发；demo CSP禁止业务网络连接
```

`dist/` 是组件库，不是网站；`demo-dist/` 才是可离线托管的演示站点。运行构建不需要在线 CDN、字体、账户或邮件服务。开发态 CSP 的 `connect-src 'none'` 可能阻止 HMR websocket；这是演示隐私约束，刷新即可查看改动。

`private: true` 故意阻止误发布。可以 `npm pack` 验证包，但本交付不执行 `npm publish`。

## 接入（不要求宿主安装 Tailwind）

目前未在 npm registry 发布。先在此仓库运行 `npm run build && npm pack`，然后在消费项目中运行 `npm install /实际路径/nova-account-0.1.0-dev.1.tgz`。tarball 是本地生成物，不提交到 Git；不要把 `npm install nova-account` 当成安装此开发版的方式。

```vue
<script setup lang="ts">
import { NovaAccount } from 'nova-account'
import 'nova-account/style.css' // 必须显式引入预编译CSS
import { createSiteAccountAdapter } from './account-adapter'

// 接入方自行实现真实接口；库不会创建网络客户端或回退到mock。
const adapter = createSiteAccountAdapter()
</script>

<template>
  <NovaAccount :adapter="adapter">
    <!-- 真实二次认证应替换security slot。 -->
  </NovaAccount>
</template>
```

适配器必须显式提供。`simulated` 仅决定演示提示和默认模拟安全表单的可见性，不授予权限。`initialUser` 只是服务端已验证会话的展示输入，不构成认证证明；所有账户 API 仍须在服务端授权。

独立使用：

```vue
<NovaTheme v-slot="theme">
  <NovaAuthForm :adapter="adapter.auth" @authenticated="onAuthenticated" />
  <NovaAppearance :model-value="theme.appearance"
    @update:model-value="theme.setAppearance" />
</NovaTheme>
```

单独组件应置于 `NovaTheme` 内。`NovaAccount` 已内置该根容器。外壳默认采用 `100dvh` 全屏布局；嵌入现有页面可设置 `layout="embedded"`，保留 header/footer 并使用自然页面高度。

### 语言、时间与路由

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { NovaAccount, type AccountPage, type NovaMessages } from 'nova-account'

const page = ref<AccountPage>('messages')
const messages: Partial<NovaMessages> = { 'auth.welcome': '登录你的账户' }
// adapter 由宿主 setup 中创建；此处沿用上文实现。
</script>

<template>
  <NovaAccount
    v-model:page="page"
    :adapter="adapter"
    locale="zh-CN"
    :messages="messages"
    time-zone="Asia/Shanghai"
    layout="embedded"
  />
</template>
```

`NovaTheme` / `NovaAccount` 提供按根隔离的 `locale`（默认 `zh-CN`，内置 `en-US`）、typed `messages` 局部覆盖、`timeZone`、`dateTimeOptions` 和 `formatTime`。独立宿主也可在 setup 调用 `provideNovaLocale(() => options)`。不依赖 vue-i18n，不使用全局可变语言状态。已显示的内置字段校验错误会随 locale / messages 更新，无需重新提交。adapter 错误、用户内容及宿主 slot 文案由接入方翻译；演示工具与合成数据仍为中文。

日期使用 `Intl.DateTimeFormat`，默认时区 UTC，避免服务器与浏览器时区差异导致 hydration 不一致；中文接入通常显式设置 `Asia/Shanghai`。服务端与客户端需传入相同配置；无效日期显示占位符，无效 Intl 配置回退到 UTC 日期。

`page` + `update:page` 支持受控导航，`initialPage` 仅设置非受控初始页，`pageChange` 反映实际页签变化。内部导航先执行 dirty guard；外部 page 更新视为宿主权威跳转，路由卸载、后退等仍需宿主自己的离开确认。

验证码默认限制 6 个字符，可用 `codeLength` 调整，传 `null` 可取消展示限制。`passwordStrength(password)` 可选返回 `{score:0..4,label,hint?}`，仅展示宿主评估，不影响提交。`NovaField` 支持 `as="textarea"`、`maxlength` 与 prefix/suffix 插槽；原生 maxlength 按 UTF-16 code units 计数，服务端独立执行实际长度和密码策略。

`useAccount().requestResult(operation)` 返回 `success` / `busy` / `cancelled` / `error` 可区分结果。原有 `request` / `load` / `mutate` 保留 `T | undefined` 兼容行为，忙碌调用不会执行或自动排队。

发行物**仅 ESM**，没有 CommonJS `require` 导出；请使用 ESM 导入或支持 ESM 的构建工具。

### 样式隔离

布局、间距、字号、状态、响应式均使用 `na:` 前缀 Tailwind utilities；仅少量颜色 tokens、根字体与组件内表单基础样式使用 CSS。没有搬运旧版大块样式。

- 不导入 Tailwind Preflight，不重置宿主 `body`、`html` 或裸元素。
- Tailwind theme defaults 定位 `.nova-account`，内部 `--tw-*` 也重命名为 `--na-tw-*`，全局初始化规则限制于组件子树；层命名为 `nova-*`。
- 主题 tokens 为 `--na-*`；消费者可在自己的 `.nova-account` 上覆盖。不同根实例的明暗与品牌色可独立。
- 原生 `<dialog>` 留在主题子树内，不 teleport 到 `body` 丢失主题。
- 宿主自己的全局 `!important` 或高优先级样式仍可能影响组件，不声称 Shadow DOM 级隔离。

## 导出与契约

| 类别       | 导出                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 组合外壳   | `NovaAccount`, `NovaTheme`                                                                                                                             |
| 业务展示   | `NovaAuthForm`, `NovaAccountCenter`, `NovaAppearance`, `NovaCaptcha`                                                                                   |
| 基础组件   | `NovaButton`, `NovaField`, `NovaDialog`                                                                                                                |
| 响应式流程 | `useAuthFlow`, `useAccount`, `useAppearance`, `parseAppearance`                                                                                        |
| 语言与时间 | `provideNovaLocale`, `useNovaLocale`, `zhCN`, `enUS`                                                                                                   |
| 错误与结果 | `NovaError`, `NOVA_ERROR_CODES`；类型 `NovaErrorCode`, `NovaRequestResult`                                                                             |
| 类型       | `NovaAdapter`, `AuthAdapter`, `AccountAdapter`, `RequestContext`, `MutationContext`, `NovaLocaleOptions`, `NovaMessages`，以及 snapshots、用户、主题等 |

详见 [接口与安全边界](docs/contracts.md)、[fetch adapter 模板](docs/adapter.md)、[接入方上线清单](docs/production-checklist.md)、[Nuxt 接入与验证](docs/nuxt.md)、[QA / 验证范围](QA.md)。

## 独立演示

右上 **体验工具 → 一键填入示例**；不会默认在主界面堆放示例凭据。工具内可快捷预览、切换外观、选择慢速/断网/验证失败/验证码过期/业务拒绝。

- 合成邮箱 `demo@nova.example`，密码 `NovaDemo2026!`，验证码 `246810`。
- 安全弹窗提供“填入示例”：新密码 `NovaNext2026!`，新邮箱 `novanext@nova.example`。
- 模拟更改不影响登录固定凭据。验证码只在演示适配器返回，真实服务不得返回明文码。
- 所有账户/消息/设备/安全状态仅内存；刷新/退出重置。只有 mode/accent 可在用户显式切换时保存。
- 生产库默认不使用浏览器存储；演示显式传入 `storage-key="nova-appearance-v1"`。严格只接受 `{mode,accent}` 两个字段，拒绝多余字段。

## 真实接入前仍需完成

服务端挑战及轨迹验证、目的/邮箱绑定、一次性凭证、验证码限流与投递幂等、密码散列、会话/权限/CSRF、安全注销、真实二次认证、消息授权、设备会话撤销、冲突及未知结果对账。组件里的滑块值不是安全凭证。

`AbortSignal` 和代数检查只防止旧响应写回当前 UI，不承诺回滚服务器已执行的操作或撤回邮件。取消后结果未知时必须由接入方服务端幂等键与查询机制核实，不得盲目重发。

自动 smoke 与 axe 扫描不替代完整视觉验收、移动软键盘、无障碍辅助技术与真实后端安全测试。包未声称生产就绪。

## 结构

```text
src/types.ts               公共typed adapter与数据契约
src/components/            原生Vue SFC
src/composables/           每实例隔离的认证/账户/主题状态
src/styles/index.css       Tailwind入口与scoped tokens，无Preflight
scripts/scope-css.ts       额外隔离Tailwind内部变量与defaults
demo/                      独立Vite应用和合成内存mock，不进库包
examples/nuxt/             Nuxt3/4 tarball消费者与SSR smoke
tests/                     unit/component/SSR测试
scripts/verify-package.mjs 独立consumer验证
dist/                      ESM、声明、CSS
demo-dist/                 静态演示站点
```

## 核验依据（2026-10-27）

官方 registry 查询并锁定 Vue `3.5.44`、Tailwind `4.3.3`、Vite `8.3.5`；TypeScript 固定 `5.9.3`，适配本项目检查工具。官方文档：[Vue TypeScript](https://vuejs.org/guide/typescript/overview)、[Vue SSR](https://vuejs.org/guide/scaling-up/ssr)、[Tailwind 关闭 Preflight / prefix](https://tailwindcss.com/docs/preflight)、[Tailwind utilities](https://tailwindcss.com/docs/styling-with-utility-classes)。
