/**
 * 「本插件创建过哪些临时目录」的持久记录。
 *
 * 记录是删除授权的唯一依据：目录名前缀只参与命名，改前缀不会让旧目录失去
 * 被本插件删除的资格。记录走 DSH 的 storage 领域，随写入即时持久化。
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** 领域名；同一进程内只允许打开一次。 */
export const DOMAIN_NAME = 'tmp_wks'

/** 记录表名。 */
export const TABLE = 'dirs'

/**
 * 一条已创建临时目录的记录。
 *
 * `path` 是创建时 realpath 过的绝对路径，同时作为表键。
 */
export const tempDirRecord = z.object({
  /** 临时目录的绝对路径。 */
  path: z.string(),
  /** 创建时间，ISO-8601 字符串。 */
  createdAt: z.string(),
  /** 创建时登记的 Workspace 标识。 */
  workspaceId: z.string(),
})

/** 一条存储中的记录。 */
export type TempDirRecord = z.infer<typeof tempDirRecord>

/** 领域声明；由插件的 `apply` 打开。 */
export const tmpWksDomainSpec = defineDomain({
  name: DOMAIN_NAME,
  version: 1,
  tables: { [TABLE]: domainTable(tempDirRecord) },
})