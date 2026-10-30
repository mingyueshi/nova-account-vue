# Nova Account Vue 开发版验证

验证日期：2026-10-30。本机 macOS / Node 24.21.0 / npm 11.19.0，同时实际运行最低 Node 22.12.0 的完整检查。Playwright 固定 1.64.1；Linux 三引擎合计 **42 条浏览器测试通过**，macOS Chromium / WebKit 另有 **28 条通过**。

本文区分本地工作区验证与已提交版本的远端结果。GitHub Actions 已运行过 `f9b7f1b`，详情见下文；本轮修复的远端验收以对应提交的 Actions 结果为准，不能据本地通过声称远端已验收这些修改。本轮未执行 npm 发布、公开演示部署、真实账户/邮件操作或 Hen / CSGO 接入。

## 已执行

| 检查                                                     | 结果与范围                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`，Node 24.21.0                            | 通过；ESLint、Prettier、strict Vue/TypeScript、V8 coverage、库构建、体积预算、离线 demo 构建                                    |
| `npm exec --yes --package=node@22.12.0 -- npm run check` | 通过；与 Node 24 相同的完整入口                                                                                                 |
| 单元、组件、SSR 测试                                     | **102 项通过，12 个文件**；包含既有回归及已显示校验错误的语言更新、提交错误焦点处理                                             |
| 实际 tarball 独立消费者                                  | ESM / CSS / Vue external / Node SSR / 严格 NodeNext TypeScript；检查新增导出、文案 key、错误码、许可证与升级文档                |
| Nuxt 3.21.11 / 4.6.3                                     | 真实 tarball；锁文件消费者；安装 JS / CSS / 声明与 dist 比较；typecheck、build、SSR route / CSS smoke                           |
| Chromium / WebKit，macOS                                 | **28 条通过**；每个引擎 14 条，见下述场景                                                                                       |
| Chromium / Firefox / WebKit，Linux                       | **42 条通过**；每个引擎 14 条；官方 Linux 镜像 / Node 24.22.1 / npm 11.19.1，设置 `CI=1`，均首轮通过                            |
| axe 自动扫描                                             | Chromium / WebKit / Firefox 中认证默认/错误/注册/挑战、账户七页、浅深色 × 四品牌色；已扫描状态无 WCAG 2 A/AA、2.1 A/AA 规则违规 |
| 主题截图                                                 | 自动采集八种外观截图供复核；没有建立像素对比基线，不声称完整视觉回归通过                                                        |
| CSS / 包边界                                             | 保留原有 CSS 隔离、八配色静态对比度、外部 Vue、无 demo 实现/凭据进入 JS 和 source map 的断言                                    |

浏览器 smoke 使用构建后的静态 demo；测试框架只启动临时 loopback 服务，结束后关闭。Nuxt smoke 也只使用临时 loopback SSR 服务。Nuxt 消费者在临时目录构建，不改写仓库示例锁文件。

Linux 验证在官方 `mcr.microsoft.com/playwright:v1.64.1-noble` 镜像中复制本轮工作区文件，重新 `npm ci` 后运行完整 `npm run test:e2e`。三引擎均保留严格 console error / pageerror 断言；本机补验只运行 Chromium / WebKit，不将未执行的 macOS Firefox 算作通过。

## 浏览器场景

- 密码登录：默认不显示滑块，End 仅移动，Enter 确认后进入账户；资料保存、消息全部已读、设备确认及当前会话保护。
- 验证码登录、注册、重置：发码前验证，后续提交不重复弹出滑块；重置第二步可滚动和提交。
- 验证码登录被 adapter 拒绝时聚焦全局错误摘要，保留输入；恢复模拟服务后可以显式重试并登录。
- 慢速挑战取消 / Esc 后切换模式，不接收迟到结果；模拟验证失败可显式恢复并重试。
- dirty 离页：原生模态、Tab 不进入后台账户控件、Esc 回焦、保留编辑、放弃草稿并导航。浏览器 chrome 可接收原生 Tab 焦点；不把浏览器地址栏当页面控件。
- 320×568、390×844、820×500、1440×900：认证、长重置表单、账户页面无整页/main 横向溢出，导航及退出可达。
- 中英文切换时更新已显示的字段错误，焦点留在语言控件；原生外观 radio 的键盘操作；刷新只保留经过白名单校验的 mode/accent，不保留账户、邮箱、密码或验证码。
- 逐状态 axe 扫描，在颜色过渡完成后检查最终主题；截图用于审阅，不承担像素级断言。

## 覆盖率与体积门槛

V8 统计 `src/**/*.ts` / `src/**/*.vue`；仅排除无执行逻辑的入口导出和静态词典。模板事件处理器也计入函数覆盖率，浏览器执行不混入单元测试覆盖率。

| 指标       | 本轮   | 全局最低门槛 |
| ---------- | ------ | ------------ |
| Statements | 90.60% | 85%          |
| Branches   | 82.70% | 75%          |
| Functions  | 76.13% | 70%          |
| Lines      | 92.05% | 90%          |

流程层 `src/composables/**` 另设 statements 90%、branches 80%、functions 85%、lines 95% 门槛；本轮均通过。门槛不自动下调。

| 发行文件                | gzip 实测    | 上限         |
| ----------------------- | ------------ | ------------ |
| `dist/nova-account.js`  | 26,599 bytes | 32,768 bytes |
| `dist/nova-account.css` | 4,013 bytes  | 6,144 bytes  |

体积统计实际发行文件，Vue 保持 external，不计 source map。调整预算需显式修改脚本，不能把 demo 体积当库体积。

## 新增和保留的关键回归

- 已显示的内置字段校验错误随 locale / messages 更新，无需重新提交且保留输入；公共 fieldErrors 仍为字符串属性。
- 表单提交后聚焦首个无效字段，无字段错误而 adapter 拒绝时聚焦全局错误摘要；摘要不新增 Tab 停靠点，语言切换不抢焦点。
- 移除 Linux WebKit 不支持的演示 viewport 参数，修复已观察到的 CI 失败；未放宽浏览器运行时错误断言。
- 首个账户快照尚未加载完成时切换内部或受控页签，仍完成共享加载，避免取消后永久空白。
- 消息操作使用包含可见内容的原生可访问名称，同时保留已读状态和详情提示；修复 axe label-in-name 问题。
- locale / override / 时间配置按根隔离；嵌套继承、响应式更新和 SSR 跨请求隔离；文本覆盖仍按文字渲染。
- UTC 默认、Asia/Shanghai 配置、Intl dateStyle/timeStyle、自定义 formatter、非法日期和非法时区降级。
- 受控 page 等待父级接受，不回声 update；真实父级 v-model 下 dirty guard、取消与草稿丢弃；外壳透传及 embedded 模式。
- `requestResult` 区分 busy / cancelled / error / success；busy 不调用第二次操作；兼容方法继续返回 undefined。
- fetch 骨架透传 signal、CSRF、revision、请求关联 ID；冲突/过期/网络/非法响应映射；不重试、不展示原始服务端错误、不把 requestId 作为幂等键。
- 验证码长度可配置或关闭；textarea 的 label/description/attrs/插槽；可选强度展示不改变密码策略。
- 页面隐藏时暂停倒计时，恢复时立即按实际时间核对冷却，卸载清理监听与定时器。
- 保留旧回归：验证/发码/提交中的关闭、换邮箱/模式/adapter/卸载；忽略 signal 的迟到结果和微任务间取消不写回；冷却、过期、确认密码、双击及显式重试。
- 保留账户 revision 冲突、已读幂等、设备保护、敏感弹窗关闭/重开与发码隔离、导出 getter adapter 更换隔离、受控主题无回声和存储拒绝降级等回归。

## 自动化入口与产物

```sh
npm ci
npm run check
npm run verify:package
npm run verify:nuxt
npx playwright install chromium firefox webkit
npm run test:e2e
```

GitHub Actions：`ci.yml` 跑 Node 22.12 / 24、独立消费者和三浏览器；`nuxt.yml` 分别验证 Nuxt 3 / 4。只读仓库权限，失败保留 coverage / Playwright artifacts，没有发布和部署步骤。

本地产物不提交：`coverage/`，`output/playwright/report/` / `results/`，Linux 三引擎的 `output/playwright-linux/`。可用 `npx playwright show-report output/playwright/report` 或 `npx playwright show-report output/playwright-linux/report` 查看 HTML 报告。

## 远端 CI 实际记录

2026-10-30 只读查询 GitHub，核验提交 `f9b7f1ba9bccbd5b5bdce6330d432d2301f11107` 的两次 push workflow：

- [Library and browser checks](https://github.com/mingyueshi/nova-account-vue/actions/runs/40808949818)：Node 22.12 / 24 的完整检查及独立 tarball 消费者通过，Chromium / Firefox 通过；Linux WebKit 失败，故整个 workflow 结论为 failure。
- [Nuxt tarball consumers](https://github.com/mingyueshi/nova-account-vue/actions/runs/40808949996)：Nuxt 3 / 4 两个 job 均通过。

WebKit job 日志中的失败来自演示页 viewport 参数 `interactive-widget` 不被识别，产生 console error，触发每个场景的运行时错误断言。本轮移除该参数，保留 `viewport-fit=cover`、响应式布局和严格的 console/pageerror 检查，不忽略该引擎的其他错误；修复后官方 Linux 镜像内的三引擎 42 条测试全部通过。真机软键盘行为仍待独立验收；本文本地验证记录不包含本轮修复提交后的远端 workflow 结果。

## 尚未执行，不得据此声称通过

- 本轮修复提交后的 GitHub 远端 Actions 通过结论；上面的旧提交运行记录不等同于修复版本通过。
- 固定截图基线/像素比较、完整人工视觉矩阵、目标宿主的浏览器 hydration 专项；Nuxt SSR smoke 不等同于 hydration 验收。
- 屏幕阅读器、真机软键盘、safe-area、实际移动浏览器与无 showModal 的旧环境回退验收。
- 真实后端认证、会话/CSRF/限流/挑战、邮件投递、未知结果核实和安全审计；Hen / CSGO 接入、npm 发布与生产部署。

真实接入必须按 [上线检查清单](docs/production-checklist.md) 完成真实 adapter、captcha/security 插槽和宿主验收；模拟开关与前端滑块均不提供安全授权。
