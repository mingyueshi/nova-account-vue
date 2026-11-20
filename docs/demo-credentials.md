# 演示账号与操作说明 / Demo accounts and flows

演示按真实用户流程操作：登录、注册、找回密码均需填写表单并完成验证。认证页面不展示测试凭据，也没有免登录预览或自动填充入口。业务场景、基础组件、配置页均在登录后的用户中心。

## 默认输入

| 用途 / Purpose                   | 输入 / Value    |
| -------------------------------- | --------------- |
| 默认邮箱 / Email                 | `demo@demo.com` |
| 用户名模式 / Username mode       | `demo`          |
| 默认密码 / Password              | `123456`        |
| 邮箱验证码 / Email code          | `123456`        |
| 4 位验证码配置 / Four-digit code | `1234`          |
| 注册示例邮箱 / New registration  | `new@demo.com`  |
| 新密码示例 / New password        | `654321`        |
| 换绑邮箱示例 / New email         | `next@demo.com` |
| 二次认证确认码 / Two-step code   | `123456`        |

这些简单输入仅用于本地演示，不是生产密码建议。所有数据为合成内存数据，不会发送真实邮件；验证码仍需通过“获取验证码”签发并绑定当前账号和用途，不会随接口响应返回。

## 常用流程

1. **登录**：输入默认邮箱和密码，提交后将验证条拖到右端并松开。键盘可用方向键、Home / End 调整，再按 Enter 确认。切换验证码登录时，先获取验证码并完成验证，再填写上表中的验证码。
2. **注册**：使用 `new@demo.com` 或其他尚未注册的邮箱，密码至少 6 位；获取验证码、完成验证、填写验证码并同意条款后提交。注册后直接进入对应账号，可以退出后用相同邮箱和密码重新登录。已有邮箱会提示直接登录。
3. **找回密码**：使用已注册邮箱，获取验证码并验证，再设置两次相同的新密码。重置后请使用新密码登录，旧密码失效。
4. **安全设置**：当前密码填写该账号正在使用的密码；新密码可填写 `654321`。换绑邮箱可使用 `next@demo.com`，先获取验证码再确认。密码和邮箱修改会影响下一次登录。在“组件接入”勾选安全页的 `#security` 插槽后，点击“设置身份验证器”，使用上表的固定确认码完成演示绑定。随后可复制或下载演示恢复码并确认保存。
5. **演示配置**：登录后在侧栏进入“演示设置”或“组件接入”，调整语言、网络、验证结果和登录方式；返回登录页体验新的流程。

账号及安全数据只保存在当前页面内存中，退出不会删除已注册账号或撤销密码修改；**刷新页面恢复初始账号和默认密码**。外观偏好可保存在本地存储，密码和验证码不写入浏览器存储。多个演示窗口各自独立。资料、消息、设备和业务场景等其余演示状态在退出时重置；注册信息与密码、邮箱变更保留到刷新。

## English

Use `demo@demo.com` / `123456` to sign in. The username-mode alias is `demo`. Request a code before entering `123456` (`1234` with four-digit codes). Verification uses a draggable handle; keyboard users can adjust the range and press Enter.

Register with a new address such as `new@demo.com` and a password of at least six characters. The new account can sign in after signing out. Resetting or changing a password invalidates the old password; changing the email also changes the sign-in address. Sample new values are `654321` and `next@demo.com`.

No real email is sent. Accounts and security changes live only in the current page's memory; refreshing restores the initial account. Other profile, message, device and business-scene state resets on sign-out. Only appearance preferences may be stored. These simple credentials are for this synthetic demo, not a production password policy.
