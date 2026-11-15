# 安装包构建与声明完整性

## 2026-11-14 异常根因

首次失败包的账户声明 `dist/index.d.ts` 已汇总，而 `dist/charts.d.ts` 仍是 204 字节的源码转导出，引用 `./components/NovaChart.vue` 和 `./chart-options`；包内还残留全套中间声明。严格 NodeNext 消费产生 TS2307/TS2834。

`vite-plugin-dts` 的流程是先向 outDir 写入完整中间声明图，再用 API Extractor 汇总各入口，最后删除中间文件。因此正在构建或中断后留下的 dist 不能作为打包快照。原 `verify:package` 和 `verify:nuxt` 直接执行 npm pack，没有构建完成屏障，也没有声明完整性检查。

通过 API Extractor 的 messageCallback 在账户入口完成、图表入口尚未汇总时触发打包，已经复现相同的混合产物。此证据定位的是打包读取可变目录的问题；最初那次运行具体与哪个写入进程重叠，没有完整进程记录，不作推断。无需修改图表组件或手写公开类型来掩盖问题。

## 当前流程

```sh
npm ci
npm run pack:library
# 根目录生成 nova-account-0.1.0-dev.2.tgz
npm run verify:package
npm run verify:nuxt
```

`scripts/package-library.mjs` 复制 src、构建脚本、配置和包文档到独立临时目录，通过符号链接复用已安装的开发依赖；不复制共享 dist。等待该目录的 Vite 构建完全退出，再验证公开声明入口非空、无相对依赖、无多余中间声明，最后在同一私有目录打包。失败即退出并清理，不回退到旧产物。手动打包通过临时文件加 rename 更新根目录 tarball；消费验证直接使用各自唯一的临时 tarball 路径。

`verify:package` 在首次安装与添加 ECharts 后，都逐字节比较安装的所有 dist 文件与该次构建，再执行账户无 ECharts、图表显式安装、ESM、SSR 和严格 TypeScript 验证。Nuxt 3/4 同样对比私有构建，包括 charts.d.ts。两个入口不会互相覆盖 tarball。

直接 `npm pack` 保留为已有 dist 的低层命令，prepack 会拒绝未汇总或残留中间声明的目录，并验证 dist/.nova-build.json 中源码、构建配置、锁文件、脚本及全部产物的内容哈希。源码新增/修改、产物缺失（包括 charts.js）或篡改均会拒绝打包；回执缺失时也要求重建。使用 npm run build 生成回执，文件时间戳不作为判断依据。生成交付安装包请使用 pack:library；不要并发打包可变的共享 dist，也不要用 ignore-scripts 绕过检查。

## 回归检查

`npm run test:package` 使用 Node 原生测试执行 tests/package-build.test.mjs，并纳入 npm run check：

- 使用实际失败包的图表声明复现并拒绝混合产物。
- 即使公开入口已汇总，也拒绝残留的中间声明；允许 Vue/ECharts 等外部 peer 类型。
- 隔离构建失败必须清理目录，不能拿旧 dist 继续打包。
- 两个真实 Vite 构建/打包同时执行，另一个进程持续覆盖共享图表声明；两份包仍必须完整、互相隔离，包内图表声明与各自完整构建一致。

独立消费验证使用真实 tarball 安装，不能以工作区组件测试或只验证源码类型替代。

## 新鲜度检查

`npm run build` 完成 Vite 构建和声明检查后生成内容哈希回执，同时生成面向 CommonJS 调用者的 `require.cjs` 错误指引。构建失败先移除旧回执；构建期间输入变化也会失败，不给混合状态签发回执。`.nvmrc`、package.json、锁文件和构建脚本也在输入校验范围内。

私有打包使用相同的构建路径，之后才执行内部 ignore-scripts 打包，避免递归调用钩子。直接在根目录 pack 仍不可与共享 dist 构建并发；交付应使用隔离管线。

新增回归覆盖完整但过期的 dist、回拨时间戳后修改源码、新增源码/配置变化、缺失及篡改 charts.js，以及 npm pack 拒绝后不产生 tarball。原有声明中间态、失败构建及并发隔离回归保留。

npm 的 prepack 在 pack / publish 生命周期执行，依据 [npm scripts 文档](https://docs.npmjs.com/cli/v11/using-npm/scripts/#life-cycle-operation-order)。仓库仍 private:true，本轮不执行发布。

## 发布阶段与 CI

当前交付仍是隔离构建的本地 tarball。本轮不增加自动 registry 发布，也不声称拥有 npm provenance。启用发布前需明确版本/公开范围、npm 组织和 trusted publisher、受保护的发布入口以及 provenance 核验；内部构建哈希回执不等同 npm 的 provenance 声明。

CI 已缓存 npm 依赖。未增加浏览器二进制缓存：Playwright 官方指出恢复耗时可能接近下载，Linux 系统依赖仍需另装，见 [官方 CI 建议](https://playwright.dev/docs/ci#caching-browsers)。这属于可选性能权衡，并非运行缺陷。

## TypeScript 升级约束

当前根项目与两个 Nuxt 示例使用 TypeScript 5.9.3。TypeScript 7.0.2 的 Dependabot #6 验证显示，现有 typescript-eslint 明确拒绝 TS7，声明构建也缺少 TS7 移除的 JavaScript Compiler API。暂在覆盖三个目录的 Dependabot 配置中忽略 TypeScript >=7；恢复前需同时验证 lint、声明构建和 Nuxt 消费，不绕过这些检查来接受升级。minor/patch 组继续维护，升级后的格式要求在对应 PR 内修正。
