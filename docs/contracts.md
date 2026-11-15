# Nova Account 接口与边界

## 原则

UI、业务 adapter、mock 三者分开。生产入口 `src/index.ts` 不导入 `demo/`。所有 adapter 必须显式传入，未实现的方法应抛出明确错误，而不是虚构成功。库不拥有真实会话、不持久化密码/token，不替接入方决定 API URL、凭据、cookie 或权限。

## 请求上下文

每个异步 adapter 方法最后一个参数为 `RequestContext`：

```ts
interface RequestContext {
  signal: AbortSignal
  requestId: string
}
interface MutationContext extends RequestContext {
  revision: string
}
```

- `signal`：关闭、切流程、换邮箱/adapter、卸载后中止本地操作；即使 adapter 忽略 signal，UI 仍按代数拒绝迟到结果。
- `requestId`：非秘密的 UI 请求关联标识；**不是持久服务端幂等键**，不得用作授权凭证。
- `revision`：账户写入基于的快照版本，服务端需检查并在冲突时返回错误；不能只依赖浏览器检查。
- adapter 返回全新或不可变 snapshot，勿在组件之外原位修改已经交付的对象。
- 错误使用 `Error` 或 `NovaError(code,message)`；message 会展示给用户，接入方应映射为安全、可读文案，勿包含内部堆栈/凭据。

## 认证接口

| 方法              | 输入                                                                   | 结果                                                     |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `challenge`       | email, purpose                                                         | `{id,kind,expiresAt,label?}`                             |
| `verifyCaptcha`   | challengeId, email, purpose, response                                  | `{token,expiresAt}`                                      |
| `sendCode`        | email, purpose, proof                                                  | `{expiresAt,retryAfter}`（秒）；demo才能额外返回demoCode |
| `login`           | password分支：email,method,password,proof；code分支：email,method,code | `{user:{id,email,displayName}}`                          |
| `register`        | email,password,code,consent                                            | `{user}`                                                 |
| `verifyResetCode` | email,code                                                             | `{token,expiresAt}`                                      |
| `resetPassword`   | email,password,verificationToken                                       | void                                                     |
| `logout`          | 无业务输入                                                             | void                                                     |

`purpose` 严格区分 `login-password` / `login-code` / `register` / `reset-password`，发码不接受 password 用途。时间为 epoch milliseconds。默认 slider 只提交 `{value:number}`；验证结论来自 adapter。真实挑战如需要图片、轨迹、签名或第三方 SDK，应返回 `kind:'custom'` 并通过 `captcha` 插槽使用专用控件。`custom` 无插槽不会回退为假滑块通过。

密码登录：challenge → verify → login。其他三流程：challenge → verify → sendCode，之后 code-login / register / verifyResetCode→resetPassword **不无条件重复 captcha**。服务端仍可拒绝过期/绑定错误等结果；额外风控流程由接入方明确设计。

密码登录的 `login` 请求失败时关闭验证弹窗，将错误显示并聚焦在登录表单，保留账号和密码供修改；再次提交会请求新的 challenge/proof。`verifyCaptcha` 失败或验证凭证无效时，错误仍留在验证弹窗中，不调用登录请求。取消后的迟到失败不会写回表单。

认证前端校验只覆盖邮箱形态、必填字段、长度上限、同意条款与确认密码一致。密码规则、邮箱所有权、注册资格、强度与真实认证必须由服务端执行；本库不宣称自动满足任何密码政策。

## 账户接口

`load(context)` 返回 `AccountSnapshot`，包括 revision、profile、email、notifications、devices、messages、security、activity。所有写操作返回完整新 snapshot：

- `updateProfile({nickname,bio,avatar,avatarUrl?}, context)` / `updateNotifications({product,email,security}, context)`。
- `uploadAvatar?({dataUrl}, context)` 可选能力：实现后内建资料页出现头像上传（组件负责选文件转 data URL、忙态与移除，`null` 清除）；组件在读取前检查图片 MIME 和 `avatarMaxBytes`（默认 2 MiB），避免过大的 data URL 分配；真实类型、内容、大小和存储仍由适配器 / 服务端验证。`Profile.avatarUrl?` 为服务端下发的图片 URL 或 data URL，空值渲染色块头像。
- `changePassword({currentPassword,newPassword,confirmPassword}, context)`。
- `requestEmailChangeCode({email,currentPassword}, context)` 返回 code metadata；`changeEmail({email,code}, context)`。
- `revokeDevice(id, context)` / `revokeOtherDevices(context)`，服务端保护当前会话并执行真实撤销。
- `markMessageRead(id, context)` / `markAllMessagesRead(context)`，服务端授权/幂等。
- `setTwoStep({enabled,currentPassword,code}, context)` 仅是扩展工作流钩子，**不是 TOTP/MFA 实现**。

默认生产安全页只读。真实安全修改通过 `security` 插槽替换为接入方的 recent-auth / passkey / TOTP 等完整流程；不要把 `simulated:true` 当成开启生产安全流程的办法。`profile` 插槽可整体替换资料页（props 同 `security`：snapshot/adapter/refresh），未保存守卫随之由宿主实现。

资料/偏好页面 dirty 时导航/退出会询问放弃；`beforeunload` 仅在浏览器挂载且有未保存数据时使用。组件卸载会清除监听。宿主路由强制卸载不自动接管路由确认，需在宿主导航设计中实现阻止离开。

手机端（视口小于 768px）使用当前页入口打开“全部功能”底部面板，按账户页面与宿主 `extraPages.group` 分组；退出登录放在面板底部。页面按钮有 `aria-current`，入口有展开状态和对话框关联；Esc、关闭按钮或点击遮罩可关闭并返回入口。先关闭导航面板再处理切页/退出及未保存提醒，避免原生模态叠加。切页后聚焦内容标题，手机端可见标题在导航栏，内容的 h1 仍供辅助技术使用。宿主强制切页或视口切回桌面时收起面板；减少动态效果时不播放面板入场动画。

## 组件 API

包仅提供 ESM import 导出，没有 CommonJS 实现；require 条件入口仅抛出带 await import(...) 用法的错误。Vue 是 peer dependency，消费者必须显式引入 `nova-account/style.css`。

### `NovaAccount`

Props：`adapter: NovaAdapter`（必填）、`initialUser?:SessionUser|null`、`appearance?:Appearance`、`storageKey?:string|false`（默认false）、`brand?:string`；支持下述 locale 配置、`page?:AccountPage` / `initialPage?:AccountPage`、`layout?:'full'|'embedded'`（默认 full）、`codeLength?:number|null`（默认 6）、`passwordStrength?:(password:string)=>PasswordStrength`、`avatarMaxBytes?:number`（默认 2 MiB）。此外支持 `identifier?:'email'|'username'`（默认 email）、`modes?:AuthMode[]`（默认四种流程）、`pages?:AccountPage[]`（默认所有账户页）、`extraPages?:AccountExtraPage[]`（默认无扩展页）、`twoStep?:boolean`（默认 true）。

Events：`authenticated(AuthResult)`、`logout()`、`update:appearance(Appearance)`、`update:page(AccountPage)`、`pageChange(AccountPage)`。只有 adapter.logout 成功才回认证页；失败会保留用户状态并展示错误。

Slots：`brand()`、`footer()`（外壳页尾）、`tools({appearance,setAppearance,storageError,signedIn})`、`captcha({challenge,submit,busy,error,cancel,retry})`、`security({snapshot,adapter,refresh})`、`securityFormTools({fill})`，以及：

- `overview({snapshot,adapter,refresh,appearance})`：默认概览下方补充内容。
- `page({page,snapshot,adapter,refresh,appearance,setAppearance,storageError})`：扩展页面内容；切到内置页时保留挂载并隐藏。
- `profile({snapshot,adapter,refresh})`：整体替换内置资料页，宿主管理草稿与离开确认。
- `authFooter({mode,resetStage,busy,fill})`：认证卡片页尾；`resetStage` 为 verify/password，`fill` 仅填展示字段，不签发验证码或通过验证。

`AccountExtraPage` 使用 `custom:` 前缀 id、label、description，可选 group/symbol。`pages` 限定内置与扩展页可见性；空列表不显示账户页面。

Exposed：`fill({email?,password?,code?,confirmPassword?})`；`fillSecurity(...)`；`preview(SessionUser)` **仅在simulated时展示**。这些仅是展示操作，不应代替服务端认证。

### `NovaAuthForm`

Props：`adapter:AuthAdapter`（必填）、`simulated?:boolean`（默认 false）、`codeLength?:number|null`（默认 6）、`passwordStrength?:(password:string)=>PasswordStrength`、`identifier?:'email'|'username'`（默认 email）、`modes?:AuthMode[]`（默认 password/code/register/reset）。Events：`authenticated(AuthResult)`、`reset()`、`mode-change(AuthMode)`。Slots：`captcha({challenge,submit,busy,error,cancel,retry})`、`terms()`、`footer({mode,resetStage,busy,fill})`。显式提供空 `footer` 插槽可隐藏默认模拟环境说明，不留空白页尾。

`PasswordStrength = {score:0|1|2|3|4,label:string,hint?:string}`，仅在注册/重置的新密码非空时展示。库不提供默认强度算法，评估不改变允许提交的条件。验证码 maxlength 是展示限制，null 关闭，服务器仍决定码策略。

Exposed：`fill(...)`、`cancel()`、`setMode(AuthMode)`。宿主应提供服务条款/隐私说明内容；默认句子不是已配置的法律文件。

表单提交失败后优先聚焦首个 `aria-invalid` 字段；没有字段错误时，聚焦本次提交产生的全局错误摘要。摘要保留 `role="alert"`，使用 `tabindex="-1"` 接收程序焦点，不增加常规 Tab 停靠点。不会仅因语言切换或文案覆盖更新而移动焦点；真实屏幕阅读器播报仍需宿主验收。

### `NovaAccountCenter`

Props：`adapter:AccountAdapter`（必填）、`simulated?:boolean`、`page?:AccountPage`、`initialPage?:AccountPage`、`pages?:AccountPage[]`、`extraPages?:AccountExtraPage[]`、`twoStep?:boolean`（默认 true）、`avatarMaxBytes?:number`（默认 2 MiB）。Events：`logout()`、`update:page(AccountPage)`、`pageChange(AccountPage)`。Slots：`appearance()`、`overview({snapshot,adapter,refresh})`、`page({page,snapshot,adapter,refresh})`、`profile({snapshot,adapter,refresh})`、`security({snapshot,adapter,refresh})`、`securityFormTools({fill})`。Exposed：`refresh()`、`fillSecurity(...)`。

`avatarMaxBytes` 仅由 `NovaAccount`（透传）和 `NovaAccountCenter` 支持，作用于内置资料页的头像上传；`NovaAuthForm` 不支持此 prop。自定义 `profile` 插槽的上传限制由宿主实现。

无 page 时内部维护页签，initialPage 默认 overview。受控模式点击只请求 update:page，父级接受 prop 后才切页；pageChange 只在有效页签实际变化时发出。内部 dirty guard 通过后才请求切页；外部 page 更新是权威输入，不回声 update，也不拦截路由，宿主应在改变路由前完成离开确认。权威切页保留内置资料 / 偏好草稿，refresh 也保留未保存字段；保存或主动放弃只重置对应草稿，退出前会提示所有剩余草稿。adapter 更换会清除旧请求/草稿，受控 page 仍由父级决定。

### `NovaTheme` / `NovaAppearance`

Theme props：`modelValue?:Appearance`, `storageKey?:string|false`；event `update:modelValue`；default slot `{appearance,setAppearance,storageError}`。

Theme 与 Account 都接受 `NovaLocaleOptions`：`locale?:'zh-CN'|'en-US'`、`messages?:Partial<NovaMessages>`、`timeZone?:string`、`dateTimeOptions?:Intl.DateTimeFormatOptions`、`formatTime?:(value:string)=>string`。默认中文和 UTC。时间源为 adapter 带 Z 或时区偏移的 ISO 字符串；不使用宿主操作系统默认时区。非法日期显示 `common.invalidTime`，非法 Intl 配置回退 UTC 日期。formatter 优先级最高，由宿主负责输出稳定性。

可在 setup 中 `provideNovaLocale(() => reactiveOptions)`，子组件通过 `useNovaLocale()` 读取 `{locale,t,formatTime}`；NovaTheme 已内置 provider。嵌套主题继承上层配置，messages 按 key 合并；同页根和 SSR 请求互相隔离。导出 `zhCN` / `enUS` 完整词典及 `NovaMessageKey` / `NovaMessages` 类型。插槽、用户数据、challenge.label 与 adapter Error.message 不自动翻译。

内置字段校验错误在显示时解析当前词典；locale 或 messages 改变后，已有错误随之更新，不会重新校验、重发 adapter 请求或清空输入。`useAuthFlow().fieldErrors` 仍是可读写的字符串属性，接入方直接写入的自定义错误由接入方维护翻译。

Appearance props：`modelValue:Appearance`, `storageError?:string`；event `update:modelValue`。`Appearance = {mode:'light'|'dark'|'system',accent:Accent}`；Accent 为与 django-nova-admin 调色板一一对应的 26 个值（'blue' | 'teal' | 'indigo' | 'violet' | 'terracotta' | 'graphite' | 'midnight' | 'forest' | 'amber' | 'ocean' | 'slate' | 'plum' | 'coffee' | 'glacier' | 'rose' | 'olive' | 'ink' | 'cinnabar' | 'gilded' | 'emerald' | 'peacock' | 'sunset' | 'industrial' | 'lilac' | 'terminal' | 'parchment'）。

SSR采用确定性初始light（或显式传入mode）；system和storage在onMounted后读取，所以可能有挂载后的主题更新。需要避免首屏主题闪烁的宿主可用服务端已知的非秘密外观数据提供初值。不要在模块顶层创建共享主题/账户控制器。

### 基础组件

- `NovaButton`：variant primary/secondary/ghost，type，disabled，busy；普通 attrs/listeners透传。
- `NovaField`：string v-model，label，as（input/textarea，默认input），type，maxlength，error，hint，autocomplete，disabled；prefix/suffix slots；支持宿主 id，未传时按实例生成；宿主 aria-describedby 与提示/错误 id 合并；attrs作用于实际input/textarea。原生 maxlength 以 UTF-16 code units 计数。
- `NovaDialog`：open/title、可选 `returnFocus?:HTMLElement|null`，close event，default/footer slots；原生dialog焦点约束、Esc请求关闭、回焦。标题与 footer 不随正文滚动，长内容在 `.nova-dialog-body` 内滚动，并约束滚动串联。默认标题获得初始焦点；关闭回焦不主动滚动底层页面；`returnFocus` 可显式指定仍存在的触发按钮，适用于 WebKit 点击按钮不自动聚焦的情况，未提供时记录打开前的活动元素。默认 slot 内的表单若通过 footer 提交按钮提交，应使用原生 `form="表单id"` 关联。无浏览器的SSR不调用DOM。
- `NovaCaptcha`：challenge,busy,error,simulated；submit(response),retry事件。`simulated` 保留为兼容输入，不再显示静态演示说明。44px 主题色手柄与浅色进度联动，键盘聚焦时短暂引导方向，拖动提供高光与按压反馈，忙态显示处理动画；支持深色主题与 `prefers-reduced-motion`，手柄位置不添加延迟过渡。从手柄开始拖动，到末端释放才提交 `{value:100}`；中途释放保留位置，取消、换题或进入忙态会终止当前手势。键盘End只移动，Enter明确提交；到达末端不表示服务端已通过验证。拖动和键盘说明保留为屏幕阅读器文本，错误按需显示并设置 `aria-invalid`，控件不是安全校验器。

## 生命周期与隐私

`NOVA_ERROR_CODES` 为内置错误码唯一来源，`NovaErrorCode` 是其值的联合类型；`NovaError` 同时接受接入方自定义字符串，保持旧 adapter 兼容。重置流程使用同一份常量识别失效凭证。

`useAccount().requestResult<T>(operation)` 返回 `NovaRequestResult<T>`：`{status:'success',value:T}`、`{status:'busy'}`、`{status:'cancelled'}` 或 `{status:'error',error:unknown}`。busy 不触发第二次调用、排队或清除已有错误。兼容方法 request/load/mutate 的忽略/失败/取消结果仍是 undefined。取消仅影响本地请求代数和显示，不能作为服务器回滚证明。

每个 composable/factory 创建独立状态；禁止在 Nuxt 模块级放置每用户 adapter 或账户状态。一个 SSR 请求创建一个真实 adapter。只有 `useAppearance` 可以在挂载后使用 localStorage，且只序列化经过两字段白名单校验的 mode/accent。用户输入经 Vue 插值渲染，无 `v-html` / `innerHTML`。

真实请求取消/超时可能是“结果未知”，UI不代表服务器未提交；接入方必须提供操作查询/核实机制以及服务端幂等处理。不能把模拟适配器的可预测挑战/验证码或abort行为移植为生产安全实现。

### 图标与可选图表

- `NovaIcon`：`name?`、`icon?:Component`、`size?:number`（20）、`strokeWidth?:number`（2）、`color?:string`（currentColor）、`label?:string`、`fallback?:string`（◇）；具名图标使用 img 语义，装饰图标隐藏。
- `NovaChart`（`nova-account/charts`）：`option:NovaChartOption`、`label:string` 必填；`description?:string`、`height?:number`（320）、`active?:boolean`（true）、`colorTokens?:string[]`、`themeKey?:string`、`errorLabel?:string`；事件 `ready()`、`error(message:string)`，无公开插槽。使用根 locale，ECharts 是可选 peer，需显式安装。

### Composable 的作用域

`useAuthFlow` / `useAppearance` 必须在组件 setup 或活动的 `effectScope.run()` 中创建（包括 Pinia setup store 的 scope）。组件在 mounted 后启用浏览器资源；非组件 scope 在浏览器中立即启用，scope.stop() / store.$dispose() 释放计时器、监听与请求。无 scope 调用会立即抛出明确错误。SSR 不启用浏览器资源；每次请求创建并停止独立 scope，不在模块顶层共享状态。

`useAccount` 仍支持无 scope 的手动控制，调用方负责 cancel/clear；在活动 scope 内自动清理。`useAuthFlow` 暴露的 tick() 可供确定性时钟测试使用；隐藏页面暂停计时器，重新可见时按当前时间校准。

外观从 storage 恢复后，如与初值不同，会通知 onChange（NovaTheme 的 update:modelValue / NovaAccount 的 update:appearance）一次，不重写 storage；来自宿主 prop 的同步仍保持静默。跟随系统只改变解析后的明暗，不改变 mode:system 本身。

作用域释放依据 [Vue effectScope/onScopeDispose](https://vuejs.org/api/reactivity-advanced.html#effectscope)。

### 运行时边界与枚举

load/mutate 验证快照的必需结构及字段类型，非法 payload 不会写入 snapshot，返回 INVALID_RESPONSE 并保留旧有效状态；不把非法 messages 伪装成有效的空列表。unread 派生值另外检查数组和 read 标志，防止宿主直接改写暴露的 ref 导致异常。非字符串 messages 覆盖退回当前内置文案，空字符串依然允许。换绑邮箱发码前校验邮箱形态；最终所有权和安全策略归服务端。

Profile.avatar 使用 iris/teal/sun/graphite，表示头像预设，与 Accent 品牌配色是不同类型，不能按 accent 更名迁移头像。resolveNovaIcon 是内部模块函数，不承诺公共导出；公共图标 API 为 NovaIcon / NOVA_ICON_NAMES。NovaChart 的 ready 在引擎实例创建时触发，error 携带底层错误字符串；二者通过组件事件绑定。

独立演示的消费者文案通过 typed `messages` 覆盖；静态模拟说明被设为空时，对应提示段落不渲染。库默认 `simulated` 文案与安全操作门槛保留。场景边界见[用户中心说明](demo-workspaces.md)。
