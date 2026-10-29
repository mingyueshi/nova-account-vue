# Fetch adapter 参考骨架

可复制的 TypeScript 实现在 [examples/adapters/fetch.ts](https://github.com/mingyueshi/nova-account-vue/blob/main/examples/adapters/fetch.ts)。复制到宿主后，将 `../../src/types` 改为 `nova-account`。此文件是传输层模板，URL 和服务端响应模型必须按宿主实现修改。

```ts
import { createFetchAdapter } from './account-adapter'
import { accountSchemas } from './server-contracts'

// 在组件 setup / 每次 SSR 请求内创建，禁止跨用户共享可变状态。
const adapter = createFetchAdapter({
  baseUrl: '/api/account',
  csrfToken: () => readHostCsrfToken(),
  decode: {
    challenge: (value) => accountSchemas.challenge.parse(value),
    proof: (value) => accountSchemas.proof.parse(value),
    delivery: (value) => accountSchemas.delivery.parse(value),
    auth: (value) => accountSchemas.auth.parse(value),
    reset: (value) => accountSchemas.reset.parse(value),
    snapshot: (value) => accountSchemas.snapshot.parse(value),
  },
  errorMessages: {
    REVISION_CONFLICT: '账户已更新，请重新加载并核对修改。',
    NETWORK_ERROR: '结果暂时未知，请先查询操作状态。',
  },
})
```

`accountSchemas` 和 `readHostCsrfToken` 是宿主必须实现的入口，未包含在库内。可使用现有运行时 schema 或手写校验；不要用 `as AccountSnapshot` 代替验证。SSR 通过 `fetch` 选项注入请求独立的客户端，并仅向受信任服务转发当前请求的会话，禁止在客户端配置中放置服务端密钥。

模板实现以下传输约定：

- 透传每个操作的 `AbortSignal`；在异步读取 CSRF token 后再次检查取消，避免关闭页面后开始新请求。
- 同源 cookie 使用 `credentials: 'same-origin'`；所有写请求要求宿主 CSRF token，读取请求不发送请求体。
- `X-Request-ID` 仅用于关联日志。它不充当授权证明或持久幂等键。
- 将 revision 作为带引号的 `If-Match` 发送。服务端应原子检查版本，写入后返回完整新快照；409 / 412 映射为 `REVISION_CONFLICT`。
- 错误仅显示本地白名单文案；保留已知过期错误码，让重置流程清除失效凭证；不会直接展示服务端 HTML、堆栈或原始 message。
- 204 可用于注销/重置等无返回值操作。需要快照的接口仍须返回通过 decoder 的数据。
- 没有自动重试。网络失败、解码失败、取消都不证明服务器未提交；通过宿主的幂等键、操作状态查询及人工核实流程处理未知结果。

`security` 插槽仍需实现完整二次认证流程；此模板本身不提供 MFA。挑战 SDK、投递限流、密码规则和会话策略属于宿主后端。上线前按 [接入清单](production-checklist.md) 验收。
