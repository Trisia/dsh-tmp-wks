/**
 * 插件配置的声明与归一化。
 *
 * 配置只在 Host 侧归一化一次，Client 通过可视配置页读写同一份值。
 */

import z from '@deepseek-ai/schemastery'
import { isAbsolute, resolve } from 'node:path'

/** 默认的容器目录名，相对于 DSH home。 */
export const DEFAULT_TEMP_DIR = 'tmp'

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
   * 绝对值直接使用；相对值基于 DSH home 解析。
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
 * 前缀必须是单个路径段：schema 用 pattern 约束，避免含分隔符的值把生成的
 * 路径带到容器目录之外。运行期仍会再校验一次，因为配置也可能来自其他层。
 */
export const Config: z<Config> = z.object({
  tempDir: z.string().default(DEFAULT_TEMP_DIR).volatile(),
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
 * @param home - DSH home 的绝对路径。
 * @param tempDir - 配置中的容器目录取值。
 * @returns 容器目录的绝对路径。
 */
export function resolveTempDir(home: string, tempDir: string): string {
  return isAbsolute(tempDir) ? resolve(tempDir) : resolve(home, tempDir)
}

/**
 * 归一化一份配置。
 * @param home - DSH home 的绝对路径。
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
  return {
    tempDir: resolveTempDir(home, unwrap(source.tempDir, DEFAULT_TEMP_DIR)),
    dirPrefix,
    confirmDirDelete: unwrap(source.confirmDirDelete, true),
  }
}