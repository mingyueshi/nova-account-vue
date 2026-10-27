# Nova Account 接口与边界

## 原则

UI、业务 adapter、mock 三者分开。生产入口 `src/index.ts` 不导入 `demo/`。所有 adapter 必须显式传入，未实现的方法应抛出明确错误，而不是虚构成功。库不拥有真实会话、不持久化密码/token，不替接入方决定 API URL、凭据、cookie 或权限。

## 请求上下文

每个异步 adapter 方法最后一个参数为 `RequestContext`：

```ts
interface RequestContext { signal: AbortSignal; requestId: string }
interface MutationContext extends RequestContext { revision: string }
```

- `signal`：关闭、切流程、换邮箱/adapter、卸载后中止本地操作；即使 adapter 忽略 signal，UI 仍按代数拒绝迟到结果。
- `requestId`：非秘密的 UI 请求关联标识；**不是持久服务端幂等键**，不得用作授权凭证。
- `revision`：账户写入基于的快照版本，服务端需检查并在冲突时返回错误；不能只依赖浏览器检查。
- adapter 返回全新或不可变 snapshot，勿在组件之外原位修改已经交付的对象。
- 错误使用 `Error` 或 `NovaError(code,message)`；message 会展示给用户，接入方应映射为安全、可读文案，勿包含内部堆栈/凭据。

## 认证接口

| 方法 | 输入 | 结果 |
| --- | --- | --- |
| `challenge` | email, purpose | `{id,kind,expiresAt,label?}` |
| `verifyCaptcha` | challengeId, email, purpose, response | `{token,expiresAt}` |
| `sendCode` | email, purpose, proof | `{expiresAt,retryAfter}`（秒）；demo才能额外返回demoCode |
| `login` | password分支：email,method,password,proof；code分支：email,method,code | `{user:{id,email,displayName}}` |
| `register` | email,password,code,consent | `{user}` |
| `verifyResetCode` | email,code | `{token,expiresAt}` |
| `resetPassword` | email,password,verificationToken | void |
| `logout` | 无业务输入 | void |

`purpose` 严格区分 `login-password` / `login-code` / `register` / `reset-password`，发码不接受 password 用途。时间为 epoch milliseconds。默认 slider 只提交 `{value:number}`；验证结论来自 adapter。真实挑战如需要图片、轨迹、签名或第三方 SDK，应返回 `kind:'custom'` 并通过 `captcha` 插槽使用专用控件。`custom` 无插槽不会回退为假滑块通过。

密码登录：challenge → verify → login。其他三流程：challenge → verify → sendCode，之后 code-login / register / verifyResetCode→resetPassword **不无条件重复 captcha**。服务端仍可拒绝过期/绑定错误等结果；额外风控流程由接入方明确设计。

认证前端校验只覆盖邮箱形态、必填字段、长度上限、同意条款与确认密码一致。密码规则、邮箱所有权、注册资格、强度与真实认证必须由服务端执行；本库不宣称自动满足任何密码政策。

## 账户接口

`load(context)` 返回 `AccountSnapshot`，包括 revision、profile、email、notifications、devices、messages、security、activity。所有写操作返回完整新 snapshot：

- `updateProfile({nickname,bio,avatar}, context)` / `updateNotifications({product,email,security}, context)`。
- `changePassword({currentPassword,newPassword,confirmPassword}, context)`。
- `requestEmailChangeCode({email,currentPassword}, context)` 返回 code metadata；`changeEmail({email,code}, context)`。
- `revokeDevice(id, context)` / `revokeOtherDevices(context)`，服务端保护当前会话并执行真实撤销。
- `markMessageRead(id, context)` / `markAllMessagesRead(context)`，服务端授权/幂等。
- `setTwoStep({enabled,currentPassword,code}, context)` 仅是扩展工作流钩子，**不是 TOTP/MFA 实现**。

默认生产安全页只读。真实安全修改通过 `security` 插槽替换为接入方的 recent-auth / passkey / TOTP 等完整流程；不要把 `simulated:true` 当成开启生产安全流程的办法。

资料/偏好页面 dirty 时导航/退出会询问放弃；`beforeunload` 仅在浏览器挂载且有未保存数据时使用。组件卸载会清除监听。宿主路由强制卸载不自动接管路由确认，需在宿主导航设计中实现阻止离开。

## 组件 API

### `NovaAccount`

Props：`adapter: NovaAdapter`（必填）、`initialUser?:SessionUser|null`、`appearance?:Appearance`、`storageKey?:string|false`（默认false）、`brand?:string`。

Events：`authenticated(AuthResult)`、`logout()`、`update:appearance(Appearance)`。只有 adapter.logout 成功才回认证页；失败会保留用户状态并展示错误。

Slots：`brand`、`tools({appearance,setAppearance,storageError,signedIn})`、`captcha`（透传）、`security`（透传）、`securityFormTools`（透传）、`footer`。

Exposed：`fill({email?,password?,code?,confirmPassword?})`；`fillSecurity(...)`；`preview(SessionUser)` **仅在simulated时展示**。这些仅是展示操作，不应代替服务端认证。

### `NovaAuthForm`

Props：`adapter:AuthAdapter`（必填）、`simulated?:boolean`。Events：`authenticated(AuthResult)`、`reset()`、`mode-change(AuthMode)`。Slots：`captcha({challenge,submit,busy,error,cancel,retry})`、`terms`、`footer`。

Exposed：`fill(...)`、`cancel()`、`setMode(AuthMode)`。宿主应提供服务条款/隐私说明内容；默认句子不是已配置的法律文件。

### `NovaAccountCenter`

Props：`adapter:AccountAdapter`（必填）、`simulated?:boolean`。Events：`logout()`、`pageChange(AccountPage)`。Slots：`appearance`、`security({snapshot,adapter,refresh})`、`securityFormTools({fill})`。Exposed：`refresh()`、`fillSecurity(...)`。

### `NovaTheme` / `NovaAppearance`

Theme props：`modelValue?:Appearance`, `storageKey?:string|false`；event `update:modelValue`；default slot `{appearance,setAppearance,storageError}`。

Appearance props：`modelValue:Appearance`, `storageError?:string`；event `update:modelValue`。`Appearance = {mode:'light'|'dark'|'system',accent:'iris'|'blue'|'teal'|'amber'}`。

SSR采用确定性初始light（或显式传入mode）；system和storage在onMounted后读取，所以可能有挂载后的主题更新。需要避免首屏主题闪烁的宿主可用服务端已知的非秘密外观数据提供初值。不要在模块顶层创建共享主题/账户控制器。

### 基础组件

- `NovaButton`：variant primary/secondary/ghost，type，disabled，busy；普通 attrs/listeners透传。
- `NovaField`：string v-model，label，type，error，hint，autocomplete，disabled；label/error id每实例生成；attrs作用于input。
- `NovaDialog`：open/title，close event，default/footer slots；原生dialog焦点约束、Esc请求关闭、回焦。无浏览器的SSR不调用DOM。
- `NovaCaptcha`：challenge,busy,error,simulated；submit(response),retry事件。键盘End只移动，Enter明确提交；控件不是安全校验器。

## 生命周期与隐私

每个 composable/factory 创建独立状态；禁止在 Nuxt 模块级放置每用户 adapter 或账户状态。一个 SSR 请求创建一个真实 adapter。只有 `useAppearance` 可以在挂载后使用 localStorage，且只序列化经过两字段白名单校验的 mode/accent。用户输入经 Vue 插值渲染，无 `v-html` / `innerHTML`。

真实请求取消/超时可能是“结果未知”，UI不代表服务器未提交；接入方必须提供操作查询/核实机制以及服务端幂等处理。不能把模拟适配器的可预测挑战/验证码或abort行为移植为生产安全实现。
