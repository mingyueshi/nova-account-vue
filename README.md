# Nova Account · Vue 组件库开发版

**状态：`0.1.0-dev.2`，可复用组件库的开发交付，不是生产认证系统。**

[English](README.en.md) · [MIT 许可证](LICENSE) · [更新与升级策略](CHANGELOG.md)

由已认可的 Nova Account 交互原型重新实现为原生 **Vue 3 + TypeScript SFC + Tailwind CSS 4**。不是 iframe、HTML 字符串包装或旧脚本容器。认证流程、账户状态、展示组件与业务接口适配器分层；独立演示使用内存 mock，mock 不进入库包。

官方源码仓库：[mingyueshi/nova-account-vue](https://github.com/mingyueshi/nova-account-vue)。[公开交互演示](https://nova-account.mingyueshi.chatgpt.site)由独立托管流程管理；本次入库不触发部署。尚未发布 npm，也未接入 Hen / CSGO 真实账户或变更两站。

## 内容

- 简洁居中认证；密码登录按需滑块；邮箱发码先验证，注册、码登录及重置提交不重复滑块。
- 全屏账户外壳、响应式侧栏/移动导航；资料、消息、设备、偏好、外观与安全展示。
- 资料/偏好保存与取消、未保存离页保护；消息详情/未读；设备确认；模拟敏感操作及活动。
- 浅色 / 深色 / 跟随系统；26 套品牌色与 django-nova-admin 调色板一一对应（默认蓝 + 25 个行业预设）；主题作用于组件根，不修改 `html/body`。
- 显式 adapter props、TypeScript 接口、typed events/slots；可单独使用组件或使用 `NovaAccount` 外壳。
- ESM、Vue peer dependency/external、自包含声明文件、独立预编译 CSS 导出。
- Nuxt 3/4 无 `ClientOnly` 的真实 tarball 接入示例及 SSR smoke。

## 全屏演示与图标

业务与组件示例沿用账户侧栏。宽屏按工作内容重排：概览与活动并列，资料分为头像和信息区，消息提供列表旁阅读，任务与订单带详情侧栏，编辑器自动展开预览。通知、外观和基础组件提供对应的预览或反馈区；空间不足时回到单列。演示布局使用账户内容容器宽度判断，兼容嵌入式宿主。

账户导航与业务操作使用 [Lucide Vue](https://lucide.dev/guide/vue) 开源 SVG。`NovaIcon` 提供内置语义名称，也支持传入额外 Lucide 组件；按名称静态导入，不依赖 CDN。演示中的「开源图标」可搜索 55 个精选图标、调整尺寸/线宽/颜色，并复制用法或 SVG。

```vue
<script setup lang="ts">
import { Camera } from '@lucide/vue'
import { NovaIcon, NOVA_ICON_NAMES } from 'nova-account'
</script>

<template>
  <NovaIcon name="security" :size="20" :stroke-width="1.75" />
  <NovaIcon :icon="Camera" label="相机" color="currentColor" />
</template>
```

`size` 默认 20，`strokeWidth` 默认 2，`color` 默认 `currentColor`。装饰图标默认 `aria-hidden`；传入 `label` 时使用有名称的 `img` 语义。`NOVA_ICON_NAMES` 列出内置名称；未知名称显示 `fallback`（默认 ◇）。图标的 ISC 与 Feather MIT 许可见 [第三方许可](THIRD_PARTY_NOTICES.md)。

## 动态图表（可选入口）

与 `django-nova-admin` 的图表实验室使用同版本 Apache ECharts 6.1.0。基础账户入口不引入或安装 ECharts；ECharts 是可选 peer（`^6.1.0`），需要图表时先运行 `npm install echarts@6.1.0` 并显式导入独立入口。演示在账户概览中汇总当前活动记录，并在「业务场景 → 数据概览」提供任务/订单、7/30 天、折线/柱状、期间构成、模拟回放、空/全零状态与 CSV 导出。数据明细与图表、汇总使用同一份筛选记录。

```vue
<script setup lang="ts">
import { NovaChart, type NovaChartOption } from 'nova-account/charts'
import 'nova-account/style.css'
const option: NovaChartOption = {
  xAxis: { type: 'category', data: ['周一', '周二'] },
  yAxis: { type: 'value' },
  series: [{ id: 'tasks', name: '完成任务', type: 'bar', data: [8, 12] }],
}
</script>
<template>
  <NovaChart :option="option" label="任务完成情况" :height="320" />
</template>
```

放在 `NovaTheme` 或账户内容区内，图表会读取主题令牌、响应容器尺寸和减少动态效果设置。`active=false` 暂停绘图；`description` 提供数值说明；`colorTokens` 可指定语义颜色变量；`errorLabel` 可替换错误提示。宿主提供可读的数据明细，并负责数据请求、定时器和离页暂停。组件卸载时释放实例和监听器；当前注册折线、柱状、饼/环形、提示、图例与范围缩放，使用 SVG 渲染。

通过 `NovaAccount` 的 `#overview="{ snapshot, adapter, refresh, appearance }"` 可在默认概览中补充账户相关内容；独立 `NovaAccountCenter` 提供同名插槽（不含 appearance）。默认账户组件不包含演示记录或回放逻辑。

## 开发

本轮本机验证环境 Node `24.21.0` / npm `11.19.0`；同时检查最低 Node `22.12.0`。锁文件固定依赖；仓库不包含 `.npmrc`、凭据、缓存、依赖目录或构建产物。

```sh
git clone https://github.com/mingyueshi/nova-account-vue.git
cd nova-account-vue
npm ci
npm run check           # lint + format + strict types + coverage + 打包竞态回归 + builds + gzip budgets
npm run pack:library    # 隔离构建后生成根目录 tarball，不读取共享 dist
npm run verify:package  # 隔离构建、pack、独立consumer安装、ESM/CSS/Node SSR/严格TS
npm run verify:nuxt     # Nuxt 3/4 真实tarball + typecheck/build/SSR smoke
npx playwright install chromium firefox webkit
npm run test:e2e        # 临时loopback演示站；交互、键盘、视口、axe与主题截图
npm run dev            # Vite演示开发；demo CSP禁止业务网络连接
```

`dist/` 是组件库，不是网站；`demo-dist/` 才是可离线托管的演示站点。运行构建不需要在线 CDN、字体、账户或邮件服务。开发态 CSP 的 `connect-src 'none'` 可能阻止 HMR websocket；这是演示隐私约束，刷新即可查看改动。

`private: true` 故意阻止误发布。使用 `npm run pack:library` 生成本地安装包，本交付不执行 `npm publish`。打包先复制构建输入，在独立目录完整构建并检查声明；不会把并发构建中的 `dist/` 打进去。直接 `npm pack` 的 prepack 只检查已有声明，不负责构建，不能替代此隔离流程。细节见 [打包验证](docs/package-build.md)。

## 接入（不要求宿主安装 Tailwind）

目前未在 npm registry 发布。先在此仓库运行 `npm run pack:library`，然后在消费项目中运行 `npm install /实际路径/nova-account-0.1.0-dev.2.tgz`。tarball 是本地生成物，不提交到 Git；不要把 `npm install nova-account` 当成安装此开发版的方式。

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

`page` + `update:page` 支持受控导航，`initialPage` 仅设置非受控初始页，`pageChange` 反映实际页签变化。内部导航先执行 dirty guard；外部 page 更新视为宿主权威跳转，不拦截但保留内置资料/偏好草稿；保存或明确取消才重置对应草稿。宿主 refresh 保留未保存草稿，切换 adapter 则清空。路由卸载、后退等仍需宿主自己的离开确认。

宿主可以通过 `extraPages: AccountExtraPage[]` 和 `#page` 插槽，把自己的业务页面接入同一套账户导航与主内容区。扩展页 ID 使用 `custom:` 前缀，支持 `label`、`description`、`symbol` 和 `group`；同样参与 `page` / `pages` 受控导航和内置资料离页确认。`#page` 提供 `{ page, snapshot, adapter, refresh, appearance, setAppearance, storageError }`，可按当前 ID 显示对应内容。插槽在切换到内置页时保留挂载并隐藏；扩展业务页自己的草稿校验与离开保护由宿主实现。

宿主裁剪功能可直接传给 `NovaAccount`，或传给对应的独立组件：

- `identifier="username"` 将账号作为文本收集，去掉首尾空白但保留大小写，仍通过 adapter 的 `email` 字段传递；邮箱模式保留原有小写规范化。`identifier` 动态变化会取消旧验证流程并清除密码、验证码；`useAuthFlow` 也支持 ref/getter 配置。
- `modes` 限制可用的 `password` / `code` / `register` / `reset` 流程。默认密码登录若不可用则选择数组首项；当前流程被移除时取消旧请求并回退。返回登录使用第一个可用登录方式，`setMode` 不接受禁用项。`modes=[]` 不显示内置表单，仍可使用宿主 footer / SSO 插槽。
- `pages` 同时限制侧栏、概览快捷入口和显示页面。当前页或 `initialPage` 不可用时，按组件固有导航顺序选择第一个可见页；`pages=[]` 不显示账户页面。受控 `page` 不会因回退产生 `update:page` 回声，宿主可依据 `pageChange` 同步实际显示页。动态裁剪页面视为宿主权威切换，隐藏的草稿在该组件实例内保留；卸载前仍需宿主确认。
- `twoStep` 默认 `true`；设为 `false` 隐藏内置两步验证操作，并关闭及取消已打开的对应操作。

这些配置只控制展示和流程，不构成服务端授权；已发出的请求被取消不代表服务器回滚。

验证码默认限制 6 个字符，可用 `codeLength` 调整，传 `null` 可取消展示限制。`passwordStrength(password)` 可选返回 `{score:0..4,label,hint?}`，仅展示宿主评估，不影响提交。`NovaField` 支持 `as="textarea"`、`maxlength` 与 prefix/suffix 插槽；原生 maxlength 按 UTF-16 code units 计数，服务端独立执行实际长度和密码策略。

`useAccount().requestResult(operation)` 返回 `success` / `busy` / `cancelled` / `error` 可区分结果。原有 `request` / `load` / `mutate` 保留 `T | undefined` 兼容行为，忙碌调用不会执行或自动排队。

发行物**仅 ESM**，没有 CommonJS `require` 导出；请使用 ESM 导入或支持 ESM 的构建工具。

### 样式隔离

布局、间距、字号、状态、响应式均使用 `na:` 前缀 Tailwind utilities；仅少量颜色 tokens、根字体与组件内表单基础样式使用 CSS。没有搬运旧版大块样式。

- 不导入 Tailwind Preflight，不重置宿主 `body`、`html` 或裸元素。
- Tailwind theme defaults 定位 `.nova-account`，内部 `--tw-*` 也重命名为 `--na-tw-*`，全局初始化规则限制于组件子树；层命名为 `nova-*`。
- 主题 tokens 为 `--na-*`；消费者可在自己的 `.nova-account` 上覆盖。不同根实例的明暗与品牌色可独立。
- 品牌色与 [django-nova-admin](https://github.com/mingyueshi/django-nova-admin) 调色板一一对应（26 套：`blue` = admin 默认配色，其余 25 个预设同名对应）。浅色模式保持中性表面、仅换品牌色；深色模式按品牌色整套切换着色表面（背景、侧栏、面板、文字、线条、控件）。`iris` 已由 `violet` 取代，旧存储值经白名单校验后安全回退到默认。
- 原生 `<dialog>` 留在主题子树内，不 teleport 到 `body` 丢失主题。
- 宿主自己的全局 `!important` 或高优先级样式仍可能影响组件，不声称 Shadow DOM 级隔离。

## 导出与契约

| 类别       | 导出                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 组合外壳   | `NovaAccount`, `NovaTheme`                                                                                                                             |
| 业务展示   | `NovaAuthForm`, `NovaAccountCenter`, `NovaAppearance`, `NovaCaptcha`                                                                                   |
| 基础组件   | `NovaButton`, `NovaField`, `NovaDialog`, `NovaIcon`, `NOVA_ICON_NAMES`                                                                                 |
| 可选图表   | `nova-account/charts`：`NovaChart`, `NovaChartOption`                                                                                                  |
| 响应式流程 | `useAuthFlow`, `useAccount`, `useAppearance`, `parseAppearance`                                                                                        |
| 语言与时间 | `provideNovaLocale`, `useNovaLocale`, `zhCN`, `enUS`                                                                                                   |
| 错误与结果 | `NovaError`, `NOVA_ERROR_CODES`；类型 `NovaErrorCode`, `NovaRequestResult`                                                                             |
| 类型       | `NovaAdapter`, `AuthAdapter`, `AccountAdapter`, `RequestContext`, `MutationContext`, `NovaLocaleOptions`, `NovaMessages`，以及 snapshots、用户、主题等 |

详见 [接口与安全边界](docs/contracts.md)、[fetch adapter 模板](docs/adapter.md)、[接入方上线清单](docs/production-checklist.md)、[Nuxt 接入与验证](docs/nuxt.md)、[QA / 验证范围](QA.md)。

## 独立演示

登录或点击右上角 **用户中心预览** 进入账号体验后，业务场景、基础组件与演示配置都在账户侧栏和主内容区。手机端使用分组页面选择器。登录、注册和找回密码表单下方直接显示当前步骤的示例账号、密码与验证码，并可点击“填入示例”；用户名模式与 4 位验证码配置会同步更新说明。右上角不再提供工具弹窗。

“演示配置”分组包含 **演示设置**（语言、时区、模拟网络及验证结果）和 **组件接入**（布局、功能、插槽及事件回调）。两个配置入口始终保留，模拟业务失败不影响进入配置恢复正常；配置页可通过“返回登录页”体验调整后的登录流程。

- **组件接入**页：全屏 / `layout="embedded"` 切换（附虚构宿主页面外壳）、`v-model:page` 受控跳转与统一事件日志（`authenticated` / `logout` / `pageChange` / `update:page` / `update:appearance`，倒序保留 8 条）、`identifier` 用户名模式（演示账号 `demo`，填写说明与示例填充会同步切换）、`modes` 登录方式裁剪、`pages` 账户页裁剪、`twoStep` 开关、`initialUser` 会话恢复（重挂载外壳直接进入账户中心）、typed `messages` 文案覆盖与 `brand` 品牌名、受控 `appearance`、`storageKey` 持久化切换（重挂载生效）、`codeLength` 调整（4 位时演示码同步为 `2468`）、宿主 `passwordStrength` 强度评估、`#security` 插槽的 TOTP 形式二次认证与危险区注销确认、`#authFooter` 第三方登录占位、禁用本地存储以触发 `storageError`、多实例主题隔离视图（两个独立 `NovaTheme` 根并排）、独立视口预览窗口（请求所选尺寸，媒体查询按实际宽度响应；浏览器可能调整窗口大小）。
- 常见错误路径：面板内可让会话过期（下一次账户请求返回 401，随后自动清除本地会话并返回登录页）、模拟另一台设备修改资料（下一次操作返回 `REVISION_CONFLICT`）；**演示设置**可开启发送限流，首次发送成功后 20 秒内再发会返回带剩余秒数的提示。
- **演示设置**中可把挑战方式切换为算术题，走宿主 `#captcha` 插槽的出题、错误提示与换一题流程；“滑块结果”的失败与过期同样适用于算术题。
- **基础组件**侧栏分组：在账户内容区展示 `NovaField` 的 prefix/suffix 插槽、`as="textarea"`、`maxlength`、禁用与错误态，以及 `NovaButton` 各变体、加载反馈与防重复提交，`NovaDialog` 的确认、表单校验和长内容三种示例。前后缀共用输入边框，另有只读、禁用与可重试校验示例。输入字段、操作按钮、对话框作为账户内页面逐项浏览，沿用账户主题与导航。
- **业务场景**侧栏分组：我的任务、内容编辑、社区互动、我的订单直接显示在账号内容区，交互说明与组件用法收在页尾的可展开区域。切换账户页会保留场景输入；从未保存的资料或偏好页离开时，沿用账户的确认流程。仅用库的基础组件组合出常见宿主形态——任务列表（搜索、状态数量、完成、空态与删除撤销）、编辑器（字数提示、并排预览、保存快照与未保存状态）、评论区（校验、发布、点赞与排序）及订单（搜索、状态筛选、商品与金额明细、详情弹窗、模拟支付后转待发货）。卡片均非库内置业务组件，数据为内存虚构。
- 内建资料页支持**头像上传**：适配器实现可选的 `uploadAvatar` 能力即出现上传 / 移除控件（组件负责选文件转 data URL 与忙态），概览卡与资料页显示 `avatarUrl` 图片；读取前检查图片 MIME 和体积，`avatarMaxBytes` 默认 2 MiB，可由宿主调整；适配器 / 服务端仍须校验真实类型、内容和大小。
- `#profile` 插槽可整体替换资料页（props 同 `#security`），演示通过“组件接入”页开关体验：头像上传 + 职位 / 电话 / 生日 / 性别 / 网址 / 兴趣标签等扩展字段（扩展字段仅存内存，真实接入由宿主扩展契约），未保存守卫由宿主实现。
- 外壳 header 常驻**明暗快切按钮**（登录前后都可随时切换；跟随系统时先落到当前实际模式再翻转，品牌色保持不变，选择经 storage-key 持久化）；完整外观设置（品牌色等 26 套）统一在用户中心的“外观设置”页。右上角提供直接进入用户中心的入口，示例填写说明位于认证表单下方。接入方可直接复制 `#tools` 插槽里的这一模式。
- 合成邮箱 `demo@nova.example`，密码 `NovaDemo2026!`，验证码 `246810`；用户名模式下演示账号 `demo`。
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

认证说明可通过 `NovaAuthForm` 的 `#footer="{ mode, resetStage, busy, fill }"` 或 `NovaAccount` 的同名作用域 `#authFooter` 定制。`resetStage` 为 `verify` / `password`，`fill` 仅更新展示字段；验证码签发、验证和提交仍走原有流程。库默认不包含示例凭据。
