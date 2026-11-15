# 用户中心场景说明 / Account workspace guide

页面按消费者日常操作呈现。测试账号见[演示账号与操作说明](demo-credentials.md)，组件接入见[公开契约](contracts.md)。下列模拟边界与实现说明集中在文档，避免占用账户页面。

## 页面与操作

| 页面     | 主要操作与布局                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 账户概览 | 身份信息、资料/安全/设备/通知入口优先，随后查看活动统计与最近动态。入口显示当前状态，不只重复“查看与管理”。                              |
| 个人资料 | 头像选择与上传、昵称和简介编辑；桌面左右分区，手机单列。邮箱为只读信息，更换请前往账号安全。保存区贴近编辑区，保留未保存状态与离开确认。 |
| 账号安全 | 密码、邮箱、两步验证操作与安全活动分区；弹窗仅呈现必要输入、校验与确认。安全活动可筛选与分页。                                           |
| 登录设备 | 查看设备名称、系统、地点、最近活动；当前设备有标识。单设备退出与退出其他设备均须确认，当前会话保留。                                     |
| 通知偏好 | 设置产品、邮件和安全提醒。桌面右侧显示当前选择，手机先显示设置和保存操作，再展示预览。开关修改后须保存。                                 |
| 消息中心 | 宽容器内列表与正文并列，窄屏使用弹窗；打开消息自动标记已读，也可批量处理未读。空态、选中状态与键盘焦点均保留。                           |
| 外观设置 | 模式与颜色即时生效，右侧显示效果。预览样式是非交互样本；恢复默认是实际操作。                                                             |
| 我的任务 | 添加、搜索、筛选、完成、删除撤销；在详情区编辑备注、日期与优先级。                                                                       |
| 内容编辑 | 标题与正文、写作模板、预览、保存草稿；保存中继续修改时仍准确显示未保存状态。                                                             |
| 社区互动 | 发布评论、查看反馈、排序、点赞与取消点赞。                                                                                               |
| 我的订单 | 筛选、搜索、明细与订单摘要；确认支付后状态转为待发货，多个订单的处理状态相互独立。                                                       |
| 数据概览 | 任务与订单趋势、日期筛选、图例、范围缩放、回放暂停及 CSV 导出；表格与图表使用同一组筛选记录。                                            |

## 演示数据边界

- 所有消息、设备、地点、活动、订单和统计记录都是合成数据。不会检测真实设备或位置，不代表真实事件。
- 账户接口和订单支付在内存中模拟，不会向银行、支付机构、邮件或推送服务发出请求，不会真实扣款。页面上的成功反馈仅表示本次内存状态更新完成。
- 注册账号、密码与邮箱变更保留到刷新；其余资料、消息、设备、任务、评论、订单等演示状态会在退出或刷新时重置。不同窗口互相独立。
- 可选安全页包含注销确认，确认后从当前窗口的内存账号表移除该账号；随后无法登录，刷新恢复初始演示数据。生产注销仍需服务端会话撤销与数据删除策略。
- 两步验证的内置表单使用固定确认码，不生成密钥、二维码或绑定真实验证器，不提供真实安全保护。生产接入应实现独立的服务端验证与 `security` 插槽。
- 资料页读取头像前检查图片 MIME 与默认 2 MiB 上限。扩展资料页的职位、电话、标签等字段是宿主示例状态，不在基础账户契约中；真实服务仍需校验文件及资料。
- 活动图表按 UTC 日期汇总；没有记录的日期记为 0。趋势页回放使用合成记录，更新时间与数据推导见源码，不代表线上实时数据。
- 外观偏好可以保存在本地；密码、验证码、订单与账户资料不写入浏览器存储。

## 接入与说明入口

账户页、“我的空间”、“常用工具”和配置仍在同一账户导航中，沿用同一主题。手机使用“全部功能”底部面板切页，桌面保留侧栏；组件页面与“演示设置 / 组件接入”服务于开发者，保留必要的控制名称和错误模拟能力，消费者账户页使用日常语言和实际操作反馈。

演示通过 `demo/presentation.ts` 的中英文消息覆盖收起组件自带的模拟说明与徽标；组件库 `simulated` 的默认提示和权限边界保留。空字符串消息不会留下空提示段落。认证页将站点品牌固定在左上角，认证表单独立居中。

## 手机认证

- 登录、注册和找回密码保留左上角站点名称。返回入口、密码显隐与切换链接提供足够的点击区域；切换页面重置认证区滚动位置，避免遗漏返回入口。测试账号与验证码仍只在文档中提供。
- 登录末字段可直接提交，注册与新密码表单可用键盘逐项前进。校验失败定位字段或错误摘要，修正内置错误后更新提示；密码显隐不会主动收起键盘，取消验证保留填写内容。
- 全屏手机演示根据 `visualViewport` 的高度与偏移调整认证区域与滑块弹窗，较短可视区域中提交操作贴近底部，当前输入避开操作区。普通高度使用自然表单顺序；嵌入布局继续交由宿主排版。监听随宿主卸载清理，捏合缩放沿用浏览器行为。
- 自动回归模拟了缩短视口、可视区域平移和键盘收起恢复，并覆盖真实验证码/滑块适配器调用；不等同于 iOS/Android 真机软键盘或屏幕阅读器验收。

## 手机端操作

- 账户与业务页的可编辑原生控件使用 16px 字号，兼顾窄屏输入和下拉选择；保存区为底部安全区域留出空间。
- 手机端顶部直接显示当前页，移除重复可见标题；“全部功能”按分组展示带图标的页面按钮和消息未读数，退出操作固定在导航面板底部。长导航独立滚动，支持关闭、Esc、遮罩及切回桌面时收起，草稿提醒在导航关闭后再打开。
- 资料和通知偏好未修改时仅保留静态保存状态，不用禁用按钮遮挡表单；有修改时保留底部保存操作，窄屏排列为状态和操作两行。设备列表将名称、平台、时间与退出操作对齐，消息操作保持可读字号与触摸高度。
- 昵称为空时就地提示并定位到输入框；宿主将错误字段对齐到视口中部，避免固定保存区遮挡。保存失败保留资料或通知草稿并聚焦错误；保存成功后，如果禁用按钮使焦点丢失，则移到保存状态。草稿保存、评论发布也保留反馈焦点，不打断继续编辑或已经切换页面的用户。
- 改密表单允许密码管理器区分当前与新密码；邮箱验证码使用数字输入提示及一次性验证码自动填充语义，获取成功后定位到验证码输入。
- 弹窗标题、关闭按钮与底部操作保持可达，正文独立滚动；短视口中同样可以完成校验、填写和确认。取消与关闭后返回原操作位置，内容滚动不应带动背景账户页。视口缩小时，若当前输入被正文区域裁切，宿主会将其重新对齐，已完整可见的字段不受影响。
- 浏览器回归覆盖 320/390px 手机尺寸与 360px 短视口。缩短视口只模拟可用空间减少，不等同于 iOS / Android 真机软键盘验收。

## 任务、内容、社区与订单

- 紧凑布局优先展示任务清单。详情按需打开，补充备注、计划日期和优先级后关闭仍保留；宽屏继续在侧栏编辑同一份数据。完成任务使其离开当前筛选时，关闭详情回到完成反馈；删除仍可撤销，后续任务操作会替换上一条撤销提示。
- 文章标题上限 80、正文 5000 个 UTF-16 code units，保存期间继续编辑不会把新内容误报为已保存。手机端保存/预览操作保留在表单附近，预览独立阅读、关闭回到编辑入口；清空会二次确认，确认后聚焦标题。模板是真实写作入口，内存重置说明留在本文。
- 社区在紧凑布局先展示讨论，底部“写评论”打开编辑弹窗。取消后保留草稿，最多 500 个 UTF-16 code units；发布后关闭弹窗并显示新评论和反馈。离开页面期间完成的发布不会抢走其他页面的焦点，宽屏保留旁置的评论表单。
- 手机订单状态横向浏览，订单号与详情按钮均可打开明细，不再堆叠重复摘要；宽屏保留旁置摘要。付款确认附近固定展示合计金额，付款结果按订单隔离；订单离开“待支付”筛选后，关闭弹窗回到订单反馈，仍可切回全部订单查看新状态。
- `demo/TaskFields.vue` 与 `demo/CommentForm.vue` 是演示内部的共享表单，不是库的新增导出。任务、草稿、评论及支付继续只操作本页内存，没有真实存储、内容发布或资金流转。

## English

Mobile authentication keeps the brand at the upper left, uses touch-sized password visibility and navigation controls, and supports input-to-input Enter navigation without intercepting IME composition. Built-in errors update after correction, code delivery is announced once, and cancelling a slider restores the initiating control. The full-screen demo follows visualViewport resize/pan events above a software keyboard; embedded layout remains host-owned. Automated viewport simulations complement real-device keyboard and screen-reader acceptance.

Account and business pages focus on the user's task: profile editing, security, devices, notifications, message reading and everyday activities. Layouts follow the available account-content width, including embedded hosts. Authentication keeps the brand at the upper left.

All accounts, messages, locations, device events, payments and charts are synthetic in-memory examples. No real email, payment, device detection or authenticator enrollment occurs. Two-step confirmation does not provide real security. Credentials and email changes survive sign-out until refresh; other example state resets on sign-out or refresh. Only appearance preferences may be stored. Production adapters must implement server-side authorization, validation, session revocation and payment processing.

Developer controls and component examples remain inside account navigation. Technical and simulation notes for consumer-facing pages live here instead of being repeated throughout the UI.
