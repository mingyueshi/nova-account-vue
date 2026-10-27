# Nova Account Vue 开发版验证

验证日期：2026-10-27。环境：云 Node 24.22.1 / npm 11.9.0。

## 已执行

| 检查 | 结果与范围 |
| --- | --- |
| `npm run typecheck` | 通过；strict Vue SFC / TypeScript |
| `npm test` | **75 项通过，8 个测试文件**；unit、jsdom组件、Node SSR、CSS隔离和8配色对比度 |
| `npm run build` | 通过；ESM + bundled自包含声明 + 预编译CSS；Vue external |
| `npm run build:demo` | 通过；独立自含静态站，无CDN；显式带完整库CSS |
| `npm run verify:package` | 通过；实际 `npm pack` 后在工作区之外的临时consumer安装，不走源码alias/link |
| 独立consumer ESM / CSS | 导出完整；CSS显式可resolve；无Tailwind编译需求；宿主与库同一Vue runtime |
| 独立consumer TypeScript | `moduleResolution:NodeNext`, `strict:true`, `skipLibCheck:false`，通过；缺adapter/错误accent的预期类型错误也检查 |
| 包边界 | 无demo目录/源码测试/依赖/环境配置；JS与source map无mock实现；CSS无Preflight、裸document reset、`:root`或未隔离`--tw-` |
| Node SSR | 4项；无window/document；同页字段ID唯一，跨请求auth/appearance/account状态隔离 |
| Nuxt 3.21.11 | 实际tarball安装，安装文件与dist比较；typecheck/build/SSR route与CSS smoke通过 |
| Nuxt 4.6.3 | 同上，通过；两者都不用ClientOnly、不装消费者Tailwind |

Nuxt smoke 启动后只访问 loopback，再关闭进程。仓库交接只保存源码，不触发演示部署、npm发布、CI运行、真实邮件/账户操作或两站修改。此前公开演示由独立主任务更新。

### 已有浏览器抽查（独立主任务）

云 Chrome 已抽查密码登录（End移动、Enter提交）进入用户中心、资料保存及受控外观切换。当前demo还包含仅演示层的重复提示/纵向间距修正。此抽查不等同于完整浏览器、移动端或无障碍矩阵。

## 重要回归覆盖

- 密码提交才加载challenge；邮箱获取码先challenge；register/code-login/reset后续提交不二次challenge。
- End仅把滑块移到末端，Enter才提交；custom挑战无slot不会假装通过。
- 验证、发码、提交中的关闭/换邮箱/换模式/换adapter/卸载；忽略AbortSignal的迟到结果不写回。
- 冷却、过期、密码确认、显式重试与双击；错误不变成成功。
- 资料/偏好dirty guard和取消；消息文本作为文字；设备当前会话保护、已读幂等和账户revision冲突。
- 敏感弹窗关闭/重开与邮箱变更；旧发码响应不进入新弹窗。
- 微任务间取消（请求已resolve、外层状态尚未赋值）仍不提交旧snapshot。
- **导出的useAccount getter自身**切换adapter时取消旧请求并清状态，不依赖组件外层watch。
- **NovaTheme真实父级v-model**外部更新不回声；一次用户更改只发一次update，避免无限递归。
- strict两字段主题存储、存储拒绝降级、系统配色监听/清理、根实例独立；不修改document主题。
- 8种明暗/品牌色组合关键正文、次级文字、品牌文本和主按钮文字对比度至少4.5:1（静态token计算）。

## 检查中发现并已修复

1. 分散Vue声明含无后缀/`.vue`路径，严格NodeNext消费者无法解析：改为bundled自包含声明。
2. 外壳转发slot推断泄漏未声明`__VLS_*`：显式typed `defineSlots`，严格消费者复验。
3. 受控主题回声循环与裸composable adapter更换隔离缺口：修复并各加回归。
4. Tailwind本身的内部变量与默认root规则不随utility prefix完全隔离：增加PostCSS命名和子树限定，包级断言。
5. Vite demo入口树摇掉库CSS：demo显式引入样式，并验证生成的完整CSS。

## 尚未执行，不得据此声称通过

- 完整浏览器视觉矩阵、浏览器hydration专项及控制台系统检查（已有上述有限抽查）。
- 桌面1440×900、1173×751，移动390×844/320×568，横屏820×500、软键盘和safe-area实机检查。
- 原生dialog焦点约束/回焦、键盘连续Enter/Esc、屏幕阅读器与跨浏览器验收。
- 真实后端认证、会话/CSRF/限流/挑战、邮件投递与取消结果核实、安全审计。
- Hen / CSGO 接入、CI、npm发布；本次仓库交接不更新公开演示。

jsdom测试与SSR smoke不能替代以上验证。

## 人工验证重点

1. 默认登录仍简洁居中，不常驻滑块；填写示例后密码登录按需验证自动进入全屏用户中心。
2. 注册/码登录/找回先发码滑块，成功输入码提交不再次弹出滑块；reset第二步可完整滚动和提交。
3. 慢速下关闭/Esc、切流程/切邮箱、重复点击、失败恢复，旧响应不跳页或写回。
4. 全屏侧栏/内容独立滚动、移动横向导航与退出按钮可达、320px无整页横溢；长表单/弹窗可滚动。
5. 资料/通知save/cancel/dirty离页，消息单条/全部已读，设备确认保护当前会话；安全演示均明确非真实。
6. 明暗/系统+四色覆盖输入、modal、错误、按钮、侧栏和消息；外部宿主裸button/input及body不被库CSS改写。
7. 刷新仅保留外观；退出或重新加载不保留个人资料、码、密码、消息和模拟安全状态。
8. 真实接入必须用生产adapter及security/captcha插槽，而非把演示开关当安全能力。
