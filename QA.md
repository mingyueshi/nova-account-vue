# Nova Account Vue 开发版验证

## 2026-11-15 手机业务页：任务、订单、文章与社区

- 任务详情在紧凑布局按需打开，备注、日期与优先级共享同一套表单；宽屏保留旁置详情。关闭保留编辑，完成任务离开当前筛选后回到状态反馈，删除可撤销，优先级使用独立 label/id 关联。
- 文章标题/正文扩充为 80/5000 字符，手机保存与预览操作固定在表单附近。预览独立弹窗可继续编辑，清空需确认且可取消，确认后聚焦标题；保存期间继续编辑保留原有快照区分。页面中的内存重置说明移入文档。
- 社区紧凑布局优先展示评论，底部入口打开 500 字符评论表单，取消保留草稿，发布后定位到反馈及新评论；离开页面期间完成的发布不抢焦点。订单筛选单行横向浏览，紧凑布局不重复展示摘要；合计始终在付款确认旁，已支付订单离开筛选后仍有反馈和稳定回焦。
- 纯阅读弹窗的正文加入命名 region 与键盘滚动入口，根节点裁切、正文滚动；新增 PageDown 及付款后标题/金额/操作可见性断言。已查看 390px 四页前后截图及 320×360 深色任务、预览、评论和订单弹窗，最终付款截图为 `output/playwright/scenes-dark-order-paid-settled.png`；缩短视口不等同于真机软键盘验收。
- `npm run check` 通过：275 项单元/组件/SSR 测试、12 项打包回归、lint、格式、类型、构建与体积检查。账户 JS 41,584 / 41,984 bytes gzip，CSS 7,549 / 7,680 bytes，预算不变，未新增运行时依赖。记录在 `/tmp/nova-scenes-check.log`。
- 早期四流程用例揭示了评论标题与字段同名、优先级嵌套标签的定位歧义，以及纯阅读正文缺少键盘滚动入口；修正后 Chrome 4/4 通过。早期截图/trace 留在 `output/playwright/scenes-first-pass/`、`scenes-second-pass/`，最终定向回归另见本节结果。
- 首轮三浏览器定向回归 71/72 通过，WebKit 宽窄切换报告 ResizeObserver 循环警告。共享宽度观察器改为跳过纯高度通知、逐帧合并最新宽度并在卸载取消，避免在通知回调内替换详情布局。新增合并/回弹/清理回归，组件专项 12/12 通过，WebKit 原场景连续复测 3/3 通过；保留严格运行时错误断言，失败 trace 位于 `output/playwright/scenes-regression-first-pass/`。
- 观察器修正后的最终 `npm run check` 再次通过：276 项单元/组件/SSR、12 项打包回归，以及 lint、格式、类型、构建和体积检查，尺寸保持不变。日志为 `/tmp/nova-scenes-final-check.log`；最终三浏览器定向回归另记于本节。
- 最终三浏览器定向回归 **72/72 通过**（Chrome、Firefox、WebKit 各 24 项，无重试），包含新业务流程、原移动端与消费者账户流、桌面宽窄切换、认证/未保存守卫、安全/头像/改密以及滑块回归；每条新手机流程包含 axe 检查。日志为 `/tmp/nova-scenes-final-regression.log`。本轮未提交 Git、推送或部署。

## 2026-11-15 手机导航与账户页第二轮打磨

- 原页面选择框替换为带当前页图标的紧凑入口和“全部功能”底部面板。账户设置、我的空间、常用工具分组展示，标记当前页和消息未读数；退出操作独立放在固定底部，长页面列表在正文滚动。桌面保留侧栏。
- 核对 320/390px 的概览、资料、安全、设备、通知、消息、外观及任务/订单页面。手机不重复显示页标题；资料与通知未修改时仅显示静态状态，不让禁用操作遮住正文；有修改时保留保存区，窄屏使用两行排列。设备合并为对齐的紧凑列表，消息与设备操作保持可读字号和触摸高度。
- 新导航可通过关闭按钮、Esc 或遮罩关闭，并回到稳定入口；宿主强制切页或视口切回桌面会收起。切页前先关闭导航，再显示未保存提醒，避免叠加原生模态。组件测试覆盖草稿保留、放弃、宿主页裁剪与受控页更新，浏览器增加入口回焦、遮罩、桌面切换与短视口检查。
- 深色 320px 实测发现首次编辑时出现的保存区可能盖住当前字段；宿主在输入、聚焦和视口变化后核对实际可见区域并滚动当前字段，避免保存区遮挡，保留弹窗正文滚动与操作固定布局。已查看修正后的字段完整可见截图及 320×360 密码弹窗，证据为忽略目录 `output/playwright/mobile-nav-*.png`；不视为真机键盘验收。
- 最终 `npm run check` 通过：272 项单元/组件/SSR 测试、12 项打包回归，以及 lint、格式、类型、构建和体积检查。账户 JS 为 41,562 / 41,984 bytes gzip，CSS 为 7,536 / 7,680 bytes；预算随新增导航调整至 41 / 7.5 KiB，不新增运行时依赖。日志为 `/tmp/nova-mobile-nav-final-check.log`。
- 完整三浏览器 357 项范围首轮 **355 通过、2 项 Firefox 页面崩溃**，单 worker 仍复现。最小 HTML 对话框在先命名定位、再通过组合角色选择器执行 evaluateAll 时同样崩溃，直接 CSS 尺寸查询则正常；与 [Firefox 2090055](https://bugzilla.mozilla.org/show_bug.cgi?id=2090055) 的跨 JS 环境 ARIA 引用缓存缺陷一致。尺寸查询改用 CSS，保留原命名定位、尺寸断言与全部 axe 规则；两个场景各重复两次 **4/4 通过**，357 项范围验证闭合。Chrome / WebKit 首轮各 119/119 通过；日志为 `/tmp/nova-mobile-nav-final-e2e.log` 与 `/tmp/nova-mobile-nav-firefox-fixed.log`，失败 trace 保存在 `output/playwright/mobile-nav-full-first-pass/` 和 `mobile-nav-firefox-debug/`。
- 另检查 320px 英文和减少动态效果：页面按钮无横向溢出，面板运行中的动画数为 0，关闭后背景滚动位置保持。截图为 `mobile-nav-english-top.png`、`mobile-nav-english-reduced.png`。本轮未提交 Git、推送或部署。
- 早期导航回归修正了旧 select/退出入口路径、干净保存区断言及入口可访问名称；失败和中断批次保留在 `output/playwright/mobile-nav-first-pass/`、`mobile-nav-interrupted-pass/`，不能作为最终通过记录。

## 2026-11-15 滑块主题色与状态动效

- 手柄跟随 Nova 主题色与 on-brand 文字色，浅色渐变轨道、方向目标和已拖动进度形成层次。键盘聚焦的方向提示仅播放两次；拖动提供高光和按压反馈，忙态提供流光及阴影脉冲，不增加服务端等待时间，也不在服务端确认前显示成功。
- 手柄位移保持直接跟随指针，未给位置添加过渡。错误使用统一的红色手柄、边界、焦点框和 `aria-invalid`；减少动态效果时，方向提示、拖动与忙态动画均停用，操作和状态文本保留。未添加动画依赖。
- 已查看 1280px 浅色、390px 深色拖动/忙态、320px 医疗青与错误状态截图。Chrome 中核对键盘方向动画、忙态动画与主题色解析；减少动态效果时运行中的动画数为 0。CDP 原生触摸模拟覆盖约 45% 位移、取消不提交、继续拖动和末端松手登录；不将模拟结果视为真机验收。截图位于忽略目录 `output/playwright/slider-color-*.png`。
- 270 项单元/组件/SSR 测试、12 项打包回归通过。最终 CSS 的 lint、格式、构建与体积检查通过；JS 为 41,042 / 41,216 bytes gzip，CSS 为 6,996 / 7,168 bytes，CSS 预算增加 512 bytes 以容纳状态动效。三浏览器定向回归 **27/27** 通过，覆盖深浅色/窄屏拖动与 axe、键盘登录、密码错误返回、取消、验证失败与自定义验证码。日志为 `/tmp/nova-slider-check.log`、`/tmp/nova-slider-final-size.log` 与 `/tmp/nova-slider-e2e.log`。未提交 Git、推送或部署。

## 2026-11-15 密码错误返回登录表单

- 区分验证失败与认证失败：滑块/凭证校验失败保留验证弹窗；验证通过后的密码登录失败关闭弹窗，登录表单显示并聚焦错误，保留账号和密码供修改。再次提交重新获取 challenge/proof。
- 新增状态机与组件回归，覆盖错误位置、输入保留、可编辑重试、验证失败不调用登录，以及取消后迟到的登录失败不写回。浏览器补充 320/1440px 错误密码纠正流程，注销后的登录拒绝断言同步改为检查表单错误。
- 最终 `npm run check` 通过：270 项单元/组件/SSR 测试、12 项打包回归，以及 lint、格式、类型、构建与体积检查。账户 JS 为 40,967 bytes gzip，比本轮修复前增加 14 bytes、超过旧预算 7 bytes；JS 预算增加 256 bytes 至 41,216 bytes，继续包含共享分块。CSS 为 6,466 / 6,656 bytes，预算不变。
- 最终 Chrome、Firefox、WebKit 认证定向回归 **27/27** 通过，包括 320/1440px 密码错误纠正、正常登录、验证码登录错误、取消、验证失败、自定义验证码、注销后登录拒绝及消费者注册/重置流程。记录位于 `/tmp/nova-password-check.log` 与 `/tmp/nova-password-final-e2e.log`。本轮未重跑全部外观矩阵，未提交 Git、推送或部署。

## 2026-11-15 手机端表单与弹窗复核

- 320px 实测中，空昵称会走服务端错误且焦点留在保存按钮；固定保存条还可能遮住获得焦点的字段。新增本地校验、保留失败草稿及错误焦点，宿主将错误字段居中对齐；测试检查字段完整显示在保存条上方，而不只检查获得焦点。
- 资料/通知保存后若禁用按钮使焦点丢失，则定位到保存状态；草稿保存、评论发布同样恢复到操作反馈，并避免打断仍在编辑或已经切页的用户。
- 弹窗标题与底部操作保留，正文在 `.nova-dialog-body` 独立滚动；核心安全表单与未保存确认使用 footer，提交按钮通过原生 form id 关联。改密使用 current-password/new-password，邮箱验证码提供数字输入与 one-time-code 语义，签发成功后定位到验证码字段，且旧请求不能抢占新弹窗焦点。
- WebKit 点击按钮不一定聚焦，单纯记录 activeElement 会丢失回焦目标；新增可选 returnFocus，并在核心账户、订单、注销操作中记录触发元素。直接卸载打开的弹窗前先退出原生模态，再回焦，避免被仍然 inert 的背景拦截。组件库默认回焦方式保留。
- 手机原生文本控件（包括图表筛选）统一 16px，头像上传与外观选项补足 44px 操作高度；保存区预留底部安全区域。浏览器覆盖 320×568 / 390×844 与 360px 短视口，不将缩短视口宣称为 iOS/Android 真机软键盘验收。
- `npm run check` 通过：266 项单元/组件/SSR 测试、12 项打包回归，以及 lint、格式、类型、构建和体积检查。账户 JS 40,953 / 40,960 bytes gzip，CSS 6,466 / 6,656 bytes，未扩大预算。独立 tarball 的 ESM、SSR、严格 TypeScript、基础入口无 ECharts 与可选图表验证通过。
- 已查看 `output/playwright/mobile-before/` 与 `mobile-after/` 截图，确认就地校验、完整显示错误字段、换绑输入和短视口操作区；缩小视口时也检查已聚焦字段没有被正文裁切。证据与诊断脚本保存在忽略目录，未加入发布包。
- 完整三浏览器回归 **345/345** 通过（Chrome、Firefox、WebKit 各 115 项）。随后增加“缩小视口后当前输入完整显示”的断言，按最新宿主对齐逻辑再次通过手机专项 **12/12**，宿主/业务组件定向单测 22/22 通过。最新 lint、格式、类型检查通过，未提交 Git、未推送或部署。

## 2026-11-15 用户中心逐页 ToC 打磨

- 登录、注册与找回密码的站点品牌统一固定在左上角，表单继续独立居中。账户外壳收紧顶栏，移除重复的演示页尾，增加可用内容高度。
- 概览将带当前状态的常用入口放在图表之前，活动统计与最近三条动态并列；资料页整理头像选择、只读邮箱和编辑区，保存操作保留未保存状态并支持窄屏滚动；安全页明确行图标与操作对齐，仅多页活动显示分页。
- 通知偏好桌面采用设置/预览分区，手机先设置与保存，再显示预览。消息列表使用带可访问名称的图标操作，处理中状态不推挤布局且保留键盘焦点补偿；900px 内容容器即可并排阅读。侧栏、通知预览和消息阅读区域各有可辨识的辅助阅读名称。
- 外观预览中的按钮样本改成非交互样式，不制造无效果按钮。任务、编辑、社区、订单中的实现说明移出页面，写作模板、草稿反馈与支付状态改用日常操作文案。
- [用户中心场景说明](docs/demo-workspaces.md) 统一说明内存数据、支付/邮件/设备/两步验证模拟、UTC 汇总及扩展资料契约。`demo/presentation.ts` 提供中英文消费者文案，组件库 `simulated` 的默认说明和安全操作边界保留。可选注销操作实际移除当前内存账号，后续登录失败，刷新恢复演示初始数据。
- `npm run check` 通过：262 项单元/组件/SSR 测试、12 项打包回归，以及 lint、格式、类型、构建、体积检查。账户 JS 40,482 bytes gzip，CSS 6,340 bytes，均未扩大预算。独立 tarball 的 ESM、SSR、严格 TypeScript、基础入口无 ECharts 和可选图表检查通过。
- Chrome 定向交互 320/390/1440px 均通过，覆盖认证页品牌位置、各用户页无可见实现说明、资料保存、通知未保存守卫及完整 axe 扫描。已查看 1440/390px 各页与 1280/320px 深色截图，额外验证窄屏滚动后的保存区仍可见；证据位于忽略目录 `output/playwright/center-after/`，不声称真机验收。
- 三引擎完整范围共 **333 项用例**：首轮 327 项通过；两项旧测试仍依赖移除的文案或全页唯一文本，导致各引擎共 6 项失败。改为检查安全状态区域、资料保存反馈和注销后登录拒绝路径后，三引擎头像上传 3/3、安全/注销 3/3 定向补跑通过，333 项范围验证闭合。初轮失败截图与 trace 保存在 `output/playwright/center-first-pass-results/`。最终源码的 lint、格式、类型及 prepack 新鲜度检查通过；本轮未提交 Git、未推送或部署。

## 2026-11-15 消费者认证流程与细节优化

- 认证页仅保留品牌、真实表单操作和必要反馈：移除填写说明、自动填充、免登录预览、登录前工具按钮和固定验证码提示。测试输入统一在 [演示账号与操作说明](docs/demo-credentials.md)，中英文 README 同步入口与当前行为。
- 滑块以单条中性轨道、44px 手柄和轻量箭头融入表单，去掉前一轮的装饰图片和拼块；连续位移、指针捕获、取消、反向拖动、末端释放和键盘提交的行为保留。获取验证码按钮收进验证码输入框，未发送时不占反馈行空间。
- 默认邮箱 `demo@demo.com`、密码和验证码 `123456`，用户名模式 `demo`。注册支持新邮箱；退出后可重新登录，重置或修改密码、换绑邮箱会更新实际后续登录输入；刷新恢复初始数据，密码不写入浏览器存储。适配器不返回明文验证码。
- `npm run check` 通过：261 项单元/组件/SSR 测试、12 项打包回归，以及 lint、格式、类型、构建和体积检查。NovaCaptcha 行覆盖率 100%、分支 91.52%。账户 JS 40,042 bytes gzip，CSS 6,340 bytes，均在现有预算内。最终独立 tarball 的 ESM、SSR、严格 TypeScript、无 ECharts 基础入口和可选图表入口检查通过。
- 已查看 1440px 桌面、390/320px 手机与深色验证弹窗截图，并检查注册、找回密码页面。Chrome 原生触摸模拟覆盖取消不提交、再拖动后成功；这属于模拟验证，未声称真机验收。截图及诊断脚本保存在忽略目录 `output/playwright/`。
- 最终源码的完整浏览器回归 **324/324** 通过（Chrome、Firefox、WebKit 各 108 项，无重试），包含注册后退出重新登录、重置后新密码登录、内联验证码操作、窄屏、拖动与深浅主题。新界面改动仅在本地，未提交 Git 或部署。

## 2026-11-15 滑块外观与拖动修复（前一阶段记录）

此阶段的图片拼块外观已被上方的简洁验证条替代，以下保留当时的验证证据。

- 原控件只有平台默认范围条：Chrome 手柄是小圆点，WebKit 是容易与背景混淆的白色手柄，背景图没有移动拼块；此前端到端流程主要使用 End/Enter，未覆盖真实拖动。新增 44px 可见手柄、主题色箭头、进度填充及图片拼块，滑块与拼块按连续位移联动。
- 指针手势仅从手柄启动，记录起始位置与轨道宽度，拖动中不重复测量布局；统一处理 Pointer Events，捕获指针后可移出控件继续拖动，末端释放才提交。途中释放可接着拖或反向拖；取消、换题与忙态终止手势。原生 range 继续提供键盘和无障碍语义，adapter 响应仍为 `{value:100}`。
- 三浏览器新增拖动回归 9/9：1280/320px 浅色、390px 深色，检查可见尺寸、轨迹比例、图片联动、点轨道不跳过验证、中途释放、反向拖动及控件外松手；每个状态也运行 axe。Chrome CDP 原生触摸模拟额外通过，覆盖末端取消不提交、再次拖动后提交；没有将其声称为真机触摸验收。
- 最终 `npm run check` 通过：258 项单元/组件/SSR 测试与 12 项打包回归，NovaCaptcha 行覆盖率 100%、分支 90.19%；lint、格式、类型、构建及体积检查通过。账户 JS 40,565 bytes gzip，仍在 40 KiB 预算内，CSS 6,233 bytes；为新增的跨浏览器轨道/手柄样式将 CSS 预算从 6 KiB 调整到 6.5 KiB。最终源码的独立 tarball ESM/SSR/严格 TS 与可选图表入口验证通过。
- 三引擎完整回归 324/324。最后补充拖动中隐藏提示、忙态恢复提示，以及背景图完整等比显示，避免 320px 起始拼块被裁掉；此后再次通过三引擎拖动 9/9 与 Chrome 原生触摸模拟 1/1。裁剪检查测量可见轮廓，不用包含被裁切场景内容的 SVG 组边界。本轮滑块改动保留在本地，未提交、推送或部署。

## 2026-11-15 Firefox 扫描与依赖升级修复

- Firefox 崩溃根因为 [Mozilla 2090055](https://bugzilla.mozilla.org/show_bug.cgi?id=2090055)：axe 在页面环境、Playwright 定位器在隔离环境读取同一 ARIA 引用属性，触发原生空指针。对照中无扫描时通过，扫描后失败；恢复焦点、旧扫描模式、清理 axe 状态都不能修复。与 [Playwright 43967](https://github.com/microsoft/playwright/issues/43967) 的复现一致。
- 通过 AxeBuilder 公开的 `axeSource` 选项，在 Firefox 测试中采用 [axe-core 5561](https://github.com/dequelabs/axe-core/pull/5561) 的非空属性优先逻辑。补丁检查固定的 axe-core 4.14.0 版本与唯一源码目标，升级时要求复核；不禁用扫描规则，不修改浏览器全局 API 或业务组件。属性为空时保留脚本引用与 ElementInternals 回退。此处理规避当前测试触发路径，不能宣称已修复 Firefox 原生引擎。
- 原完整 axe 用例与 3 项新增回归定向通过 4/4。新增用例覆盖定位器/扫描交替读取、错误名称仍报告违规、脚本引用仍正确解析。所有扫描入口统一使用该构造器。
- 在独立工作区 `codex/fix-dependency-upgrade-regressions` 处理 Dependabot #11：保留其依赖升级，Playwright 补到 1.65.1，并按 Prettier 3.10.0 格式化 DemoAuthGuide、SceneGallery、NovaAccountCenter 三个文件。TS7 暂缓：三个目录保留 TypeScript 5.9.3，Dependabot 忽略 TypeScript >=7，等待 lint 与声明工具链兼容。
- 当前工作区及升级工作区的 `npm run check` 均通过：各 256 项单元/组件/SSR 测试、12 项打包回归，以及 lint、格式、类型、构建与体积预算。
- 当前工作区与升级工作区的三引擎完整回归各 315/315，共 630 项：每套 Chrome、Firefox、WebKit 各 105/105，通过全部外观、业务、图表、布局及新增 ARIA/主题继承用例。升级工作区的独立 tarball ESM/SSR/严格 TypeScript 与 Nuxt 3/4 typecheck/build/SSR/CSS 验证也通过。升级分支的远端结果以 [PR #11 checks](https://github.com/mingyueshi/nova-account-vue/pull/11/checks) 为准。
- 已向 #11 推送修复提交 `959c04a`，未合并。该提交的远端 Linux [库与浏览器工作流](https://github.com/mingyueshi/nova-account-vue/actions/runs/43656160170) 和 [Nuxt 工作流](https://github.com/mingyueshi/nova-account-vue/actions/runs/43656160175) 均成功：依赖检查、Node 22.12/24 完整检查和独立消费者、三浏览器、Nuxt 3/4 全部通过。三浏览器各 105 项，无失败重试记录。此记录对应 PR 提交，不代表未合并的远端 main 已变绿。

## 2026-11-15 WebKit 深色样式复核

以下记录首次验证，包括当时尚未修复的 Firefox 失败；后续处理见上节。

- 根因是测试所用 WebKit build 2370 的原生 `<select>` 样式缓存缺陷，对应上游 [WebKit 326092](https://bugs.webkit.org/show_bug.cgi?id=326092) 和 [修复提交](https://github.com/WebKit/WebKit/pull/75823)。下拉框参与样式计算时，从旧祖先样式解析选项并缓存祖先链，导致面板已绘制深色、`getComputedStyle()` 却仍报告浅色变量。标题不在这条缓存链上，仍返回深色前景，axe 因此读到错误组合。
- 原始完整用例复现的是 1 条 `color-contrast` 违规、2 个标题节点；断言 diff 的 `+93` 不是 93 个违规节点。等待 1 秒或关闭容器查询仍失败，面板无颜色过渡，不能归因为“深色动画尚未落定”。
- 纯 HTML 对照不依赖 Vue、axe、容器查询或项目 CSS：插入、隐藏后显示、可见下拉框的 3 个场景在旧引擎均失败，替换为 `<input>` 的 3 个场景均通过。升级 Playwright / playwright-core 到 1.65.1、WebKit 到 build 2388 后，这 6 个对照场景及原完整深色 axe 用例均通过。
- 固定新工具链版本及 lockfile，保留现有动画结束等待和全部 axe 规则；没有增加 sleep、强制重绘或页面主题补丁。新增 3 个具名引擎回归用例，并在真实设置/宿主集成页面扫描前检查面板与主题根节点的变量、面板与标题的前景色是否一致。
- `npm run check` 通过：256 项单元/组件/SSR 测试、12 项打包回归，以及 lint、格式、类型、构建和体积预算。
- 本机 macOS 三引擎首次矩阵：Chrome 102/102、WebKit 102/102、Firefox 101/102，共 305 项通过。Firefox 的完整 axe 流程在填写登录邮箱时发生 `Page crashed`，未到深色页断言；失败 trace 与矩阵报告保留在忽略目录 `output/playwright/theme-investigation/`。不将此次运行记为 306/306。
- Firefox 单 worker 定向复跑和开启浏览器日志后的复跑仍失败；日志与 macOS 崩溃报告确认为内容进程 SIGSEGV。旧 Firefox build 1555 的额外对照未能启动（`Could not find profile folder`），因此无法据此判断崩溃是否由此次升级引入。该问题尚未解决，未增加重试或绕过检查；本轮也未验证真实 Safari 或远端 Linux CI。

## 2026-11-14 运行时输入与依赖追加复核

- 补齐快照边界校验、翻译覆盖类型防护、邮箱格式校验和消息焦点恢复。纠正 prop 注释，明确内部图标解析函数与独立头像枚举；Lucide 移到开发依赖并保留打包许可检查；ESM-only 提供明确的 require 错误指引。加入已验证的开发 Node/npm 元数据。
- `npm run check`：21 个文件、256 项单元/组件/SSR 测试及 12 项打包回归通过；行覆盖率 97.00%、分支 90.20%；lint、格式、类型、构建与体积预算通过。邮箱去空格最后调整后，账户组件 29/29 及库重建通过。
- Mac Chrome 完整回归 99/99，通过拆分后的 52 个外观 axe 用例、可控时钟迟到响应、慢速标已读焦点，以及既有业务、图表和布局检查。未重跑 Firefox/WebKit。
- 独立 tarball 消费者验证：没有 Lucide / ECharts 仍可使用基础账户 ESM/SSR/严格 TS；图表在显式安装 ECharts 后通过；两个 require 入口均给出动态 import 指引。Nuxt 3/4 类型、构建、SSR、CSS 通过。许可清单检查通过。
- 最终账户 JS 含共享 chunk 40,087 bytes gzip / 40 KiB，CSS 5,930 bytes / 6 KiB，图表增量 2,033 bytes / 4 KiB。当前仍 private，未新增或执行自动 registry 发布/provenance；不把浏览器缓存缺失当作缺陷。逐项依据见复核记录。

## 2026-11-14 追加 scope 与打包新鲜度复核

- 基于 `c555fee`，保留此前头像 prop 文档修正；外观恢复补通知、非组件 scope 补浏览器生命周期，并补齐组件 API 与双语说明。逐项结论见 [复核记录](docs/review-2026-11-14.md)。
- `npm run check`：21 个文件、240 项测试与 12 项 Node 打包回归通过；总体行覆盖率 96.65%、分支 89.30%。AccountCenter 行 96.10%、语句 94.65%、函数 85.23%、分支 89.29%，新增单文件门槛通过。
- 打包测试覆盖源码变化、回拨时间戳、新增输入、配置变化、缺失/篡改 charts.js、完整但过期产物被 npm pack 拒绝，以及原有声明中间态/失败构建/并发隔离。正常根目录 npm pack --dry-run 通过，包含 charts.js、charts.d.ts 与构建回执。
- `verify:package` 的私有构建、安装文件比对、账户无 ECharts、显式图表、ESM/SSR/严格 TypeScript 通过；`verify:nuxt` 的 Nuxt 3/4 typecheck/build/SSR/CSS 通过。Chrome 定向 4/4（外观持久化、码登录、登录退出事件、限流），未重跑完整浏览器矩阵。
- 账户 JS 连共享 chunk 39,240 bytes gzip / 40 KiB，CSS 5,930 bytes / 6 KiB，图表增量 2,033 bytes / 4 KiB。最后将清理注册提前至资源启动前，相关 34 项测试、重建和 prepack 检查通过。本轮未发布或部署，未提交 Git。

## 2026-11-14 图表声明打包完整性

基于 `ad652b9` 的本地修复，未提交、推送或部署。详细机制和入口见 [安装包构建与声明完整性](docs/package-build.md)。

- 原失败包同时包含已汇总的 index.d.ts、204 字节的未汇总 charts.d.ts 及整套中间声明。通过单个 dts 插件的 API Extractor messageCallback，在同一中间阶段触发旧式打包，复现相同混合产物；首次失败对应哪个并发写入进程没有完整日志，不作推断。
- 消费验证与手动打包改用私有源码快照，等待构建、验证声明完整性后才打包；不读取共享 dist。直接 npm pack 的 prepack 会拒绝未汇总、空白或残留中间声明的目录。安装后对所有 dist 文件作字节对比，防止旧安装包或中间文件混入。
- 完整 `npm run check` 已通过，含原有 232 项单元/组件/SSR 检查、Node 打包回归、类型、格式、库/演示构建和体积预算。打包回归覆盖失败样本、prepack 拒绝、空声明、残留中间文件、外部 peer、失败清理，以及两个真实构建同时运行且共享 dist 持续被覆盖。
- 独立安装包消费已多轮通过，包含并发执行、Node 24.21.0 和 Node 22.19.0；覆盖无 ECharts 的账户 ESM/SSR/严格 TypeScript、显式安装后的图表和共享语言上下文。当前 Nuxt 3/4 的安装字节一致性、typecheck/build/SSR/CSS smoke 也通过。
- 未更改组件运行行为或依赖版本，本轮未重跑浏览器三引擎；最小 Node 22.12.0 留给对应 CI 矩阵，不将 22.19.0 等同于最低版本验证。

## 2026-11-14 缺陷逐项复核

基于 `905f1bb` 的本机工作区修复；逐项判定和兼容契约说明见 [复核记录](docs/review-2026-11-14.md)。未提交、推送或部署。

- Node 22.19.0：`npm run check` 通过，20 个文件、232 项测试；行覆盖率 95.74%，分支 88.37%。NovaCaptcha 函数 92.30%、分支 88.46%，NovaAuthForm 分支 85.07%，新增单文件门槛通过。
- 账户 JS **连同共享 chunk** 39,122 bytes gzip、CSS 5,930 bytes；账户图之外的图表增量 2,033 bytes，均在预算内。单独图表加共享 locale 10,721 bytes，不含外置 ECharts。
- `npm run verify:package`：无 ECharts 的账户 ESM/SSR/严格 TypeScript 消费通过，显式安装后图表入口及跨入口语言上下文通过。`npm run verify:nuxt`：最终库的 Nuxt 3/4 typecheck、build、SSR route 与 CSS smoke 全部通过。
- Chrome 既有 45 项回归通过，含 52 套外观 axe 与 320–2560px 布局；新增密码弹窗空值、不一致、错误焦点及修正后提交用例通过。完整 46 项运行中该新增用例曾因测试按钮名与实际文案不符超时，修正定位器后单独复测 1/1 通过，未把该中间运行记为一次 46/46 通过。
- `npm audit --audit-level=high` 通过：高危/严重 0，另有 13 项 moderate 报告；未作超出本轮范围的依赖大版本升级。运行时 27 个依赖的许可证清单检查通过（含可选图表链）。新增 CI 与 Dependabot 配置未远端执行。
- `.v2c/plugin_root` 已由 `.gitignore` 实际匹配。最终格式及 `git diff --check` 通过。本轮未重跑 Firefox/WebKit，也未接入真实认证后端。

## 2026-11-14 演示配置整合

- 将演示设置与组件接入迁入用户中心分组导航，移除右上角工具弹窗及重复入口。登录、注册和重置密码直接显示当前步骤的示例值与填写操作，随用户名模式、验证码长度和语言更新；填写不自动同意条款或通过验证。
- 配置页不受页面裁剪影响，模拟断网或请求拒绝时仍可通过“用户中心预览”恢复配置。切换外观持久化目标后保留演示会话。
- `npm run check` 通过：19 个文件、213 项测试，行覆盖率 94.92%；库与演示构建、类型、lint、格式和体积预算通过。账户 JS 38,066 bytes gzip、CSS 5,935 bytes、图表适配器 2,002 bytes。
- 本机 Chrome 完整回归 45/45，通过账户流程、配置导航、示例填写、响应式布局和 axe 检查；最终填写按钮忙态及空模式处理调整后，另复测相关配置与登录形态 3/3。
- `npm run verify:package` 通过独立 tarball 的 ESM、CSS、Node SSR 与严格 TypeScript 消费验证。此轮未重跑 Firefox、WebKit 或 Nuxt，未提交或部署。

## 2026-11-12 云端头像隔离修复

基于官方 `c0669cf` 的修复候选；不代表浏览器、生产或远端 CI 已验收。

- 将内置头像文件读取、上传与移除接入账户统一请求控制，固定操作开始时的 adapter，切账号/离页/卸载取消读取并拒绝迟到响应。
- 新增 9 项竞态回归：旧成功/失败、读取中换 adapter、旧请求不解除新忙态、双向资料保存互斥、离页/卸载、读取错误恢复。原缺陷在修复前已通过延迟头像响应复现。
- Node 24.22.1：`npm run check` 通过，211 项测试，行覆盖率 94.92%，分支 86.66%；账户 JS 38,013 bytes gzip、CSS 5,935 bytes、图表适配器 2,002 bytes，均在预算内。
- 独立包 ESM/CSS/SSR/严格 TypeScript 消费验证通过。
- 云端真实浏览器仍未完成：固定 Playwright Chromium 不存在；系统 Chromium 启动时 `process_singleton` 的 `socket()` 返回 `Operation not permitted`，未到页面断言。未将其视为产品测试失败或通过，未绕过限制。未重跑 Nuxt、Firefox/WebKit、最低 Node 或真实后端。

人工补验重点：慢速头像上传或文件读取时切换账号、离开页面、退出/卸载，旧头像或错误不应回到新界面；资料保存与头像操作不应并发。客户端取消不代表已提交的服务端写入回滚。

## 2026-11-12 本机全屏精修与动态图表

本地工作区验证，未提交或部署。对照 `django-nova-admin/dist/styles.css`、`dist/presets.css`、`dist/js/open-icons.js` 和 `dist/js/chart-lab-data.js` 对齐配色、Lucide 线宽与 ECharts 版本。25 套深色预设的品牌、背景、面板、文字、边界令牌与后端逐项一致；默认浅色使用冷灰底，辅助文字采用后台预设的 `#5a667c`，保留控制边界和深色柔和背景的对比度调整。

- `npm run check`：lint、format、strict types、202 项测试、覆盖率门槛、构建和体积预算通过；行覆盖率 92.26%。修正对比度测试的属性选择器引号匹配，使 52 种主题组合实际检查各自令牌。
- Chrome 完整回归 44/44，通过账户流程、全屏重排、图表筛选/回放/CSV 下载、320–2560px 图表尺寸与深色 axe；额外复测最终比例、线型与窄屏图表 3/3。52 套外观预览和扩展页的 axe 扫描通过。
- 逐页浏览 16 个账户页面；1920px、390px、320px 主内容均无横向溢出。头像预设、详情侧栏、操作反馈与表单字段经过实际截图检查。
- `npm run verify:package`：独立 tarball 消费者的 ESM、CSS、严格 TypeScript 与 Node SSR 通过，包括可选图表入口；检查基础账户 JS 不导入 ECharts，图表类型声明独立输出。
- 实际 gzip：账户 JS 37,875 bytes / 40 KiB，CSS 5,935 bytes / 6 KiB，可选图表适配器 2,002 bytes / 4 KiB。演示的 ECharts 引擎约 205 KB gzip，按需载入，不包含在上述基础账户预算中。

本轮浏览器结论限定为本机 Chrome；未重跑 Firefox、WebKit 和 Nuxt 验证。

## 2026-11-09 云端增量审查

基线 `6975baa`（2026-11-07），独立克隆最新 `main`，未改动用户本地工作区。本轮修复宿主 `identifier` / `modes` / `pages` / `twoStep` 的边界，以及 demo 切换多实例丢失主会话和 320px 预览高度不符的问题；未发布 npm 包或部署站点。

- Node 24.22.1 与最低 Node 22.12.0：完整 `npm run check` 均通过，包括 lint、format、typecheck、覆盖率、库与 demo 构建、体积预算。单元/组件/SSR 共 122 项（13 个文件），含本轮 19 项新增回归。
- 覆盖率：statements 91.55%、branches 84.69%、functions 78.85%、lines 93.20%；流程层额外门槛也通过。实际 gzip：JS 27,366 / 32,768 bytes，CSS 4,013 / 6,144 bytes。
- `npm run verify:package`：通过实际 tarball 的独立 ESM / CSS / Vue external / Node SSR / strict TypeScript 消费者验证。
- `npm run verify:nuxt`：Nuxt 3 / 4 锁文件消费者的 typecheck、build、SSR route / CSS smoke 均通过。浏览器 hydration 不在此断言范围内。
- 新增失败用例在修复前复现：禁用 auth 模式仍可进入、动态移除不取消旧请求、用户名被小写、identifier 校验不更新、Home/End 导航错误、账户 pages 约束遗漏、两步验证被隐藏后旧操作仍可提交。另以真实 demo 组件验证切换多实例保留主会话/页面/草稿、关闭工具弹窗、返回后仍可保存，以及两种弹窗尺寸参数。
- 当前云端容器的真实浏览器验证：**未完成**。固定 Playwright Chromium 下载返回无效 ZIP；尝试现有 Chromium 时，浏览器在启动阶段因 `process_singleton` socket `EPERM` 退出，未运行到页面断言。jsdom 测试不能替代浏览器布局、焦点、axe 或原生弹窗验证。

### 远端增量结果与 Firefox 测试差异

修复提交 `6ce96ca` 的 [Library and browser checks](https://github.com/mingyueshi/nova-account-vue/actions/runs/42542244371) 中 Node 22 / 24、独立包消费者、Chromium / WebKit 各 26 条通过；[Nuxt tarball consumers](https://github.com/mingyueshi/nova-account-vue/actions/runs/42542244306) 的 Nuxt 3 / 4 均通过。Firefox 为 24/26，仅两个 popup 尺寸断言失败，不能将此运行称为三引擎通过。

原因：Playwright Firefox 向整个 context 设置固定 viewport，未像 Chromium/WebKit 那样根据 `window.open` features 更新 popup 的模拟视口。后续回归保留 Chromium/WebKit 根据 features 自动模拟视口的尺寸断言（也不等同于原生窗口管理器行为）；Firefox 记录调整前的实际 DOM 视口，再明确调用 `setViewportSize` 验证 320×568 / 390×844 内容和无横向溢出，不将其算作原生 popup 自动调尺寸通过。请求给 `window.open` 的精确尺寸参数另由真实 demo 组件测试验证。宿主提示已说明浏览器可调整/忽略新窗口尺寸。后续提交的三引擎结论须查看其自身 Actions。

### 多实例窄屏回归

Mac Chrome 对精确提交 `570969a` 的 320×568 复测发现：文档 `scrollWidth=336`，多实例卡片从 x=16 延伸到336，源于网格 `minmax(320px,1fr)` 的最小列宽没有扣除容器左右内边距。卡片内容自身没有额外溢出。

修复将最小列宽限制为容器可用宽度，并允许 grid item 收缩；不使用 `overflow:hidden` 掩盖裁切。新增真实浏览器回归检查 320/390px 单列、820px 双列以及320px嵌入布局，逐项验证文档/卡片/输入/按钮边界、内容无横向溢出、两个表单可输入以及返回单实例。此补丁的最终三引擎结果以自身提交 Actions 为准。

### 已登录嵌入布局回归

Mac Chrome 对 `0f68b65` 的独立复测路径“用户中心预览 → 个人资料 → layout=embedded → 关闭工具”发现：320×568 下文档 `scrollWidth=467`、`clientWidth=305`，`.demo-single` 的 grid min-content 宽451.73px。该问题与多实例网格分别处理：宿主外层与单实例内层均改为 `minmax(0,1fr)` 轨道，单实例容器允许收缩，不通过裁切隐藏内容。新增320/390px真实浏览器用例涵盖精确复现路径、资料编辑保存、七个账户页、文档及主内容内部无横向溢出。候选的结果仍以对应提交的Actions为准。

### 本地补验

在 Mac mini 或具备浏览器运行条件的 CI 上拉取本次修复提交，先核实工作区无未保存改动，再执行：

```sh
npm ci
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
```

若先用已安装的 Chrome 快验：`CHANNEL=chrome npm run test:e2e -- --project=chromium`。单引擎通过不能算三引擎通过。

人工重点：

1. 账号大小写保留；仅验证码登录、禁用注册/重置、运行中切换 identifier/modes；单登录模式表单可访问名称和 Home/End 键。
2. pages 仅含 profile/security 或为空时，不显示其他页面或概览快捷入口；受控页切换及草稿离开确认。
3. 动态隐藏两步验证后旧弹窗关闭且迟到结果不回写。
4. 登录后编辑未保存资料，切换到多实例再返回：会话、页面、输入均保留，工具弹窗没有残留原生 modal/inert 状态。
5. 320×568、390×844 新窗口的实际视口、单/多实例窄屏溢出、键盘焦点；多实例极窄布局和出入时焦点仍需人工评估。

真实后端认证、邮件/CSRF、真实挑战、目标宿主 hydration、真机键盘和屏幕阅读器仍按上线清单独立验收。取消客户端请求不证明服务端回滚。远端 CI 结论以本次提交 SHA 的运行记录为准，不引用旧版本通过作为本轮结论。

以下为 2026-10-30 的历史验证记录，不能代替当前提交的结果。

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
| 主题截图                                                 | 自动采集五十二种外观截图供复核（26 种品牌色 × 明暗）；没有建立像素对比基线，不声称完整视觉回归通过                              |
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
