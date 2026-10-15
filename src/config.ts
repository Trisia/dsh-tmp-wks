/**
 * 插件配置的声明与归一化。
 *
 * 配置只在 Host 侧归一化一次，Client 通过可视配置页读写同一份值。
 */

import z from '@deepseek-ai/schemastery'
import { isAbsolute, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * 默认的容器目录：操作系统的临时目录。
 *
 * 各平台的取值来源不同——Linux/macOS 读 `TMPDIR`，Windows 读 `TEMP` 再退到
 * `TMP`——这些差异由 `os.tmpdir()` 统一处理，它最终必定回退到平台自身的默认
 * 位置（如 Linux 的 `/tmp`）。取值在插件启动时确定一次。
 *
 * 仅在操作系统连临时目录都给不出时（返回空串）才回退到 DSH home 之下：此时
 * 仍然需要一个磁盘上的落脚点，而不是让创建直接失败。
 * @param home - DSH home 的绝对路径，作为最后的兜底基准。
 * @returns 容器目录的完整绝对路径，永不为空串。
 */
export function defaultTempDir(home: string): string {
  const osTemp = tmpdir().trim()
  return osTemp === '' ? resolve(home, 'tmp') : resolve(osTemp)
}

/** 默认的目录名前缀。 */
export const DEFAULT_DIR_PREFIX = 'tmp-'

/**
 * 用户可写的插件配置。
 *
 * 全部字段可选：省略即取默认值，因此空配置等价于默认行为。
 */
export interface Config {
  /**
   * 存放临时工作区的容器目录。
   *
   * 绝对值直接使用；相对值基于 DSH home 解析。省略时取操作系统的临时目录。
   */
  tempDir?: string
  /** 临时目录名前缀，只参与命名，不再作为删除授权的依据。 */
  dirPrefix?: string
  /** 删除临时工作区时，是否弹出「是否同时删除磁盘目录」的提示。 */
  confirmDirDelete?: boolean
}

/**
 * 名称前缀的合法形式：单个路径段。
 *
 * 禁止路径分隔符、`.` 与 `..`，避免前缀把容器目录的边界带偏。
 */
const SEGMENT_PATTERN = /^(?!\.{1,2}$)[^/\\]+$/

/**
 * 校验并归一化配置。
 *
 * 三个字段都标注 `volatile()`：设置仅把 volatile 字段投影进配置表单，普通
 * 标量字段不会出现在可视配置页上。
 *
 * `tempDir` 的 schema 默认值是空串而不是操作系统的实际临时目录：默认值依赖
 * 运行环境（`os.tmpdir()` 与 DSH home），只能在插件启动时由 `resolveConfig`
 * 按进程求值。schema 这一层只把「未配置」表达为空串，启动后的运行期配置里
 * 不会再出现空串。
 *
 * 前缀必须是单个路径段：schema 用 pattern 约束，避免含分隔符的值把生成的
 * 路径带到容器目录之外。运行期仍会再校验一次，因为配置也可能来自其他层。
 */
export const Config: z<Config> = z.object({
  tempDir: z.string().default('').volatile(),
  dirPrefix: z.string().default(DEFAULT_DIR_PREFIX).pattern(SEGMENT_PATTERN).volatile(),
  confirmDirDelete: z.boolean().default(true).volatile(),
})

/** 归一化后的运行期配置。 */
export interface ResolvedConfig {
  /** 容器目录的绝对路径。 */
  tempDir: string
  /** 目录名前缀。 */
  dirPrefix: string
  /** 删除时是否提示同时删除磁盘目录。 */
  confirmDirDelete: boolean
}

/**
 * 取出配置字段的当前取值。
 *
 * 标注 `volatile()` 的字段在运行期是支持 `get()` 的引用对象，而不是裸值；
 * 未标注的字段仍是裸值。两种形态都要接受，否则读到的会是一个对象。
 * @param field - 配置字段的原始值。
 * @param fallback - 字段缺失时的取值。
 * @returns 该字段的实际取值。
 */
function unwrap<T>(field: unknown, fallback: T): T {
  if (field === undefined || field === null) return fallback
  const get = (field as { get?: () => unknown }).get
  return (typeof get === 'function' ? get.call(field) : field) as T
}

/**
 * 解析容器目录：绝对值直接用，相对值基于 DSH home。
 *
 * DSH home 在客户端会话下是空串（无常驻主目录），而客户端会话正是本插件最常
 * 用的场景。`resolve('', 'tmp')` 会落到进程当前目录，语义过于隐式，因此这里显式
 * 以 `process.cwd()` 作为相对路径的基准。
 * @param home - DSH home 的绝对路径；不可用时为空串。
 * @param tempDir - 配置中的容器目录取值。
 * @returns 容器目录的绝对路径。
 */
export function resolveTempDir(home: string, tempDir: string): string {
  if (isAbsolute(tempDir)) return resolve(tempDir)
  return resolve(home === '' ? process.cwd() : home, tempDir)
}

/**
 * 归一化一份配置。
 *
 * `tempDir` 的优先级是「用户显式配置 > 操作系统临时目录 > DSH home 下的 tmp」：
 * 用户填了值就以它为准，未填时用操作系统临时目录，仅当系统连临时目录都给不出
 * 时才落到 DSH home。
 *
 * 插件启动时调用一次，返回值中的 `tempDir` 必定是操作系统的完整绝对路径——
 * 即使配置为空串也不会原样保留：空值在此处即被物化为 `os.tmpdir()` 的结果。
 * 因此运行期与配置页看到的都是可直接使用的完整路径，不存在「空串」中间态。
 * @param home - DSH home 的绝对路径；不可用时为空串。
 * @param config - 可选的用户配置。
 * @returns 运行期使用的绝对路径与前缀。
 * @throws 前缀不是单个路径段时抛错；该值会让临时目录落到容器之外。
 */
export function resolveConfig(home: string, config: Config | undefined): ResolvedConfig {
  const source = (config ?? {}) as Record<string, unknown>
  const dirPrefix = unwrap(source.dirPrefix, DEFAULT_DIR_PREFIX)
  if (!SEGMENT_PATTERN.test(dirPrefix)) {
    throw new Error(`dirPrefix must be a single path segment, got ${JSON.stringify(dirPrefix)}`)
  }
  // 空白串等同于未配置，否则用户留空会把容器目录解析成进程工作目录本身。
  const configured = String(unwrap(source.tempDir, '')).trim()
  // 空配置在此物化为操作系统的完整路径，后续一律按绝对路径处理。
  const tempDir = resolve(configured === '' ? defaultTempDir(home) : resolveTempDir(home, configured))
  if (tempDir === '' || !isAbsolute(tempDir)) {
    // 兜底断言：走到这里说明物化逻辑被破坏，宁可启动失败也不要建到意外位置。
    throw new Error(`could not resolve an absolute temp directory, got ${JSON.stringify(tempDir)}`)
  }
  return {
    tempDir,
    dirPrefix,
    confirmDirDelete: unwrap(source.confirmDirDelete, true),
  }
}