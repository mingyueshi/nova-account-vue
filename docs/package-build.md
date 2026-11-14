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

直接 `npm pack` 保留为已有 dist 的低层命令，prepack 会拒绝未汇总或残留中间声明的目录。生成交付安装包请使用 pack:library；不要并发打包可变的共享 dist，也不要用 ignore-scripts 绕过检查。

## 回归检查

`npm run test:package` 使用 Node 原生测试执行 tests/package-build.test.mjs，并纳入 npm run check：

- 使用实际失败包的图表声明复现并拒绝混合产物。
- 即使公开入口已汇总，也拒绝残留的中间声明；允许 Vue/ECharts 等外部 peer 类型。
- 隔离构建失败必须清理目录，不能拿旧 dist 继续打包。
- 两个真实 Vite 构建/打包同时执行，另一个进程持续覆盖共享图表声明；两份包仍必须完整、互相隔离，包内图表声明与各自完整构建一致。

独立消费验证使用真实 tarball 安装，不能以工作区组件测试或只验证源码类型替代。
