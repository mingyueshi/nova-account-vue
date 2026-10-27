# Nuxt 3 / Nuxt 4 接入

这里是最小 **SSR** 接入示例，不是完整账户后端。无需安装 Tailwind，无需 `ClientOnly`，也没有 iframe 或 HTML 注入。两个示例均从实际 npm tarball 安装 `nova-account`，不是引用工作区源码。

## 运行

在库根目录先构建本地安装包：

```sh
npm ci
npm run build
npm pack
cd examples/nuxt/nuxt3 # 或 ../nuxt4
npm install ../../../nova-account-0.1.0-dev.1.tgz
npm run typecheck
npm run build
npm run smoke
```

tarball 不提交到仓库。每次重建包后显式执行上述 `npm install <tarball>`，让示例lockfile同步当前本地包的完整性；首次安装也会安装其余锁定依赖。

`smoke` 仅启动短暂的 loopback SSR 服务器，验证服务端 HTML 与打包后的 CSS，然后关闭。示例不会发布、不会创建真实账户，也不会发送邮件。

- Nuxt 3 使用根目录 `app.vue`。
- Nuxt 4 使用 `app/app.vue`。
- `nuxt.config.ts` 的 `css: ['nova-account/style.css']` 显式引入预编译样式。
- Vue 是库的 peer dependency，组件内部不会打包另一份 Vue。
- 示例固定依赖 Nuxt 3.21.11 / Nuxt 4.6.3 与 Vue 3.5.44；以每个示例的 lockfile 为准。

## 业务适配边界

示例在组件 `setup` 内创建显式拒绝请求的 `AuthAdapter`。点击提交会收到 `ADAPTER_NOT_CONFIGURED`，不会静默切换 mock。接入方需替换它并通过受保护的同源服务实现服务端挑战、验证、邮箱码发送、注册、登录、重置、限流和会话管理。

不要在服务端模块顶层保存用户、token 或可变 adapter 实例；每次 Nuxt 请求应使用独立状态。HTTP-only 会话及服务器端授权属于宿主。不要把服务端密钥放在 public runtime config、Vue props 或 hydration payload。

默认 slider 仅提供展示交互，不能成为安全边界；真实挑战需要自行实现 `captcha` slot 和对应 adapter。已发送邮件或已提交服务器变更不能因为浏览器 abort 而认定回滚；取消之后要按服务端状态核实。

## SSR 与主题

`NovaTheme` 在服务端使用明确的初始 `modelValue`；跟随系统以及可选 storage 读取只在 mounted 后生效，以避免服务端直接使用 `window`/`document`。默认没有浏览器存储。启用 `storage-key` 后只允许持久化 `{ mode, accent }`；不要把账户资料或认证状态交给此配置。

宿主应该为每次请求传入确定的初始主题，必要时自行提供非敏感主题偏好；不要在服务端推测系统配色。SSR smoke 不等于浏览器 hydration、无障碍或真机验证。

## 官方参考

- [Nuxt rendering modes](https://nuxt.com/docs/4.x/guide/concepts/rendering)
- [Nuxt 4 directory structure](https://nuxt.com/docs/4.x/directory-structure/app)
- [Nuxt CSS configuration](https://nuxt.com/docs/4.x/getting-started/styling)
- [Vue SSR and cross-request state pollution](https://vuejs.org/guide/scaling-up/ssr.html#cross-request-state-pollution)

## 已执行验证（2026-10-27，云 Node 24.22.1）

| 验证 | 结果 |
| --- | --- |
| Node 环境 SSR 单测（无 `window` / `document`） | 4 项通过；包括同页字段 ID、跨请求认证/主题/账户状态隔离 |
| 实际 tarball 独立安装 | ESM exports、显式 CSS export、同一 Vue runtime、SSR 通过 |
| 独立 TypeScript 消费者 | `strict: true`、`moduleResolution: NodeNext`、`skipLibCheck: false` 通过 |
| Nuxt 3.21.11 / Vue 3.5.44 | 安装的 JS / 声明与库 dist 逐字节一致；typecheck、build、SSR route / CSS smoke 通过 |
| Nuxt 4.6.3 / Vue 3.5.44 | 同上，全部通过 |

Nuxt示例未执行：真实浏览器 hydration、视觉布局、屏幕阅读器及跨浏览器/真机验收；真实账户和邮件服务也未接入。公开独立demo的有限浏览器抽查见根QA，不由构建或 SSR smoke 代替。
