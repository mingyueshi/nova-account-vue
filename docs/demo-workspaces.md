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

业务场景、基础组件和配置仍在账户侧栏，沿用同一主题与导航，不另设工具弹窗。组件页面与“演示设置 / 组件接入”服务于开发者，保留必要的控制名称和错误模拟能力；消费者账户页使用日常语言和实际操作反馈。

演示通过 `demo/presentation.ts` 的中英文消息覆盖收起组件自带的模拟说明与徽标；组件库 `simulated` 的默认提示和权限边界保留。空字符串消息不会留下空提示段落。认证页将站点品牌固定在左上角，认证表单独立居中。

## English

Account and business pages focus on the user's task: profile editing, security, devices, notifications, message reading and everyday activities. Layouts follow the available account-content width, including embedded hosts. Authentication keeps the brand at the upper left.

All accounts, messages, locations, device events, payments and charts are synthetic in-memory examples. No real email, payment, device detection or authenticator enrollment occurs. Two-step confirmation does not provide real security. Credentials and email changes survive sign-out until refresh; other example state resets on sign-out or refresh. Only appearance preferences may be stored. Production adapters must implement server-side authorization, validation, session revocation and payment processing.

Developer controls and component examples remain inside account navigation. Technical and simulation notes for consumer-facing pages live here instead of being repeated throughout the UI.
