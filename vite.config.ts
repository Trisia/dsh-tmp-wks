/**
 * 构建 DSH 加载的 dist/index.js（Host）与 dist/client.js（Client）。
 *
 * 两个 target 是彼此独立的库构建，各自配置见 environments。
 * 用法：`npm run build`。
 */

import { defineConfig, type Plugin } from 'vite'
import { builtinModules } from 'node:module'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const PKG = '@cliven/dsh-tmp-wks'

/** Node 内置模块（含 `node:` 前缀）一律 external。 */
const NODE_EXTERNAL = [...builtinModules, ...builtinModules.map((n) => `node:${n}`)]

/** 非相对导入一律 external：Host 侧由 DSH 运行时解析，Client 侧由页面模块表供给。 */
const BARE_EXTERNAL = [/^[^./]/]

/**
 * 把 Client 的 CJS 产物包成模块加载器注册形式。
 *
 * DSH 以 `window.__ModuleLoader__.load({id, factory})` 收集插件，工厂需返回带
 * `apply` 与 `inject` 的 exports，这一步纯配置表达不了。
 * @returns 在 writeBundle 阶段改写 client 产物的 Vite 插件。
 */
function moduleLoaderWrapper(): Plugin {
  return {
    name: 'dsh-module-loader-wrapper',
    apply: 'build',
    async writeBundle(options, bundle) {
      // 顶层插件对两个环境都会触发；只处理 Client 那一份产物。
      const chunk = Object.values(bundle).find((item) => item.type === 'chunk' && item.fileName === 'client.js')
      if (chunk === undefined) return
      const target = join(options.dir ?? join(root, 'dist'), chunk.fileName)

      const body = (await readFile(target, 'utf8')).trim()
      const indented = body.split('\n').map((line) => `\t\t${line}`).join('\n')
      await writeFile(target, [
        'window.__ModuleLoader__.load({',
        `\tid: ${JSON.stringify(PKG)},`,
        '\tfactory: (require) => {',
        '\t\tvar module = { exports: {} };',
        '\t\tvar exports = module.exports;',
        indented,
        '\t\treturn module.exports;',
        '\t},',
        '});',
        '',
      ].join('\n'))
    },
  }
}

/**
 * 把发布所需的资源复制进 dist，让 dist 成为自包含的发布单元。
 *
 * - `cordis.patch.yml`：bundle 的 Loader 补丁，由 `dsh.bundle.patch` 指到 dist。
 * - `icon.svg`：插件卡片图标，必须留在包根之内，故指到 dist。
 * - `locale/*.json`：插件元数据，经 exports 映射解析。
 * @returns 复制完成后的 Promise。
 */
async function copyReleaseFiles(): Promise<void> {
  const dist = join(root, 'dist')
  await mkdir(join(dist, 'locale'), { recursive: true })
  await copyFile(join(root, 'cordis.patch.yml'), join(dist, 'cordis.patch.yml'))
  await copyFile(join(root, 'icon.svg'), join(dist, 'icon.svg'))
  for (const lang of await readdir(join(root, 'locale'))) {
    await copyFile(join(root, 'locale', lang), join(dist, 'locale', lang))
  }
}

export default defineConfig({
  root,
  logLevel: 'warn',
  // 插件必须挂在顶层：Vite 8 不会把 environments.<name>.plugins 里的写盘钩子接进来。
  plugins: [moduleLoaderWrapper()],
  builder: {
    /**
     * 依次构建 Host、Client，最后把发布资源复制进 dist。
     *
     * 释放资源的解析规则由 package.json 决定（`dsh.bundle.patch` 走文件路径，
     * `icon` 限定在包根内，`locale/*.json` 走 exports 映射），本步骤只负责放到位。
     */
    async buildApp(builder) {
      await builder.build(builder.environments.host)
      await builder.build(builder.environments.client)
      await copyReleaseFiles()
    },
  },
  environments: {
    host: {
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        lib: { entry: join(root, 'src/index.ts'), formats: ['es'], fileName: () => 'index.js' },
        target: 'node22',
        rollupOptions: { external: [...NODE_EXTERNAL, ...BARE_EXTERNAL] },
      },
    },
    client: {
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        minify: false,
        lib: { entry: join(root, 'src/client.tsx'), formats: ['cjs'], fileName: () => 'client.js' },
        rollupOptions: { external: BARE_EXTERNAL, output: { exports: 'named' } },
      },
    },
  },
})