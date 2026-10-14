/**
 * Host 半：临时工作区的 Remote 服务。
 *
 * 创建（命名、建目录、登记 Workspace）与删除都在 Host 完成，Client 只发指令。
 * 名字与路径的生成规则因此不必跨端约定。
 *
 * 删除授权以「已创建目录记录」为唯一依据：目录名前缀只参与命名，改前缀不会
 * 让旧目录失去被删除的资格。记录随创建写入 storage 领域，容器目录边界作为
 * 第二道护栏，防止记录被污染后越界删除。
 */

import { mkdir, realpath, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { randomInt } from 'node:crypto'
import { Service, type Context } from '@deepseek-ai/cordis'
import { bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { resolveConfig, type Config } from './config.js'
import { TABLE, tmpWksDomainSpec, type TempDirRecord } from './domain.js'

export { Config } from './config.js'

/** Remote 命名空间；Client 侧服务键为 `remote.tmpWks`。 */
const NAMESPACE = 'tmpWks'

/** 随机名字符集，剔除易混淆的 0/O/1/l/I。 */
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

/** 随机名长度，单位：字符。 */
const ID_LENGTH = 6

/** 目录重名后的最大重试次数，单位：次。 */
const MAX_ATTEMPTS = 5

/** `create()` 返回的新建工作区。 */
export interface CreatedWorkspace {
  /** Workspace 标识，用于 `startSession()`。 */
  workspaceId: string
  /** 新建的临时目录绝对路径。 */
  path: string
  /** Workspace 显示名。 */
  title: string
}

/**
 * 删除结果码。
 *
 * `needs-confirm` 表示校验已通过、但配置要求先问过用户，磁盘未被触碰；
 * `refused-*` 表示目标越界被拒。
 */
export type DeleteCode =
  | 'deleted'
  | 'missing'
  | 'needs-confirm'
  | 'refused-container'
  | 'refused-outside'
  | 'refused-unknown'
  | 'delete-failed'

/** `deleteDirectory()` 的返回值。 */
export interface DeleteResult {
  code: DeleteCode
  /** 仅在 `delete-failed` 时给出，说明失败原因。 */
  message?: string
}

/** 运行期配置快照，供 Client 展示当前生效值。 */
export interface TmpWksState {
  /** 容器目录绝对路径。 */
  tempDir: string
  /** 目录名前缀。 */
  dirPrefix: string
  /** 删除时是否提示同时删除磁盘目录。 */
  confirmDirDelete: boolean
}

/** 生成一个随机目录名。 */
function shortId(): string {
  let id = ''
  for (let i = 0; i < ID_LENGTH; i += 1) id += ALPHABET[randomInt(ALPHABET.length)]
  return id
}

/**
 * 判断 child 是否位于 parent 之下。
 * @param parent - 父目录绝对路径。
 * @param child - 待判断的绝对路径。
 * @returns 严格位于其下时为 true；相等不算在内。
 */
function isInside(parent: string, child: string): boolean {
  // 用 sep 拼前缀，避免 `/a/bc` 被误判为 `/a/b` 的子路径。
  return child.startsWith(parent.endsWith(sep) ? parent : `${parent}${sep}`)
}

/** 目录校验结论；通过时附带解析软链后的真实路径。 */
type Verdict = { ok: true; path: string } | { ok: false; reason: DeleteCode }

/**
 * 承载 Remote 方法的服务。
 *
 * Gateway 依据接收者的 `typertRemote` 绑定定位服务，因此必须是 Cordis Service。
 * 记录表在 `start()` 中打开：领域名是 single-open 的，句柄必须单例持有。
 */
class TmpWksService extends Service {
  /** 归一化后的配置。 */
  private readonly settings: TmpWksState

  /** 已创建目录记录的存储表；领域尚未打开时为 undefined。 */
  private table: KvTable<string, TempDirRecord> | undefined

  /** 已打开领域的关闭句柄。 */
  private closeDomain: (() => Promise<void>) | undefined

  constructor(ctx: Context, config: Config | undefined) {
    super(ctx, NAMESPACE)
    this.settings = resolveConfig(ctx.dshHomePath(), config)
    this.typertRemote = bindTypertRemote(this, NAMESPACE, { namespace: NAMESPACE })
  }

  /** 读取 Workspace 注册表；未挂载时抛错，避免静默建不出工作区。 */
  private registry(): { create(path: string): Promise<{ id: unknown; path: string; title: string }> } {
    const registry = this.ctx.get('workspaceRegistry')
    if (registry === undefined) throw new Error('dsh-tmp-wks: workspaceRegistry is unavailable')
    return registry
  }

  /**
   * 打开记录领域并持有句柄。
   *
   * 领域名是 single-open 的，因此句柄必须单例持有；重复打开会以 `already-open`
   * 失败。storage 不可用时服务保持不可用，Client 会以「当前环境不支持修改配置」提示——
   * 这是刻意的：没有记录就没有可信的删除授权。
   *
   * 服务读取一律走 `ctx.get()`：本服务由 `apply` 直接构造、没有自己的 fiber，
   * 属性式访问（`ctx.storageDomain`）会因缺少注入声明而抛错。
   */
  async start(): Promise<void> {
    const facility = this.ctx.get('storageDomain')
    if (facility === undefined) throw new Error('dsh-tmp-wks: storageDomain is unavailable')
    const domain = await facility.open(tmpWksDomainSpec)
    this.closeDomain = () => domain.close()
    this.table = domain.table(TABLE)
  }

  /** 释放领域句柄。 */
  async stop(): Promise<void> {
    const close = this.closeDomain
    this.closeDomain = undefined
    this.table = undefined
    await close?.()
  }

  /** 记录表；未启动时抛错，避免以空表静默放行。 */
  private records(): KvTable<string, TempDirRecord> {
    if (this.table === undefined) throw new Error('dsh-tmp-wks: the tmp_wks domain is not open')
    return this.table
  }

  /** 当前配置快照，供 Remote 读取。 */
  getState(): TmpWksState {
    return { ...this.settings }
  }

  /**
   * 列出本插件创建过、且仍存在于磁盘上的临时目录。
   *
   * 界面据此与工作区列表比对：工作区消失了但目录还在，就说明用户从内置入口
   * 删掉了工作区，从而提示是否清理目录。
   *
   * 顺带惰性剔除磁盘上已不存在的记录：「记录在、目录没了」等价于该目录已被
   * 删除，剔除后列表自然收敛。
   * @returns 现存目录的路径，按创建时间倒序。
   */
  async list(): Promise<string[]> {
    const rows: Array<{ path: string; createdAt: string }> = []
    const stale: string[] = []
    for (const [key, value] of this.records().entries()) {
      try {
        // realpath 同时验证存在性与软链，避免记录指向已失效的链接。
        await realpath(key)
      } catch {
        stale.push(key)
        continue
      }
      rows.push({ path: value.path, createdAt: value.createdAt })
    }

    for (const key of stale) await this.records().delete(key)
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => row.path)
  }

  /**
   * 创建临时工作区：生成未占用的目录名、建目录、登记 Workspace 并记录路径。
   * @returns 新建的 Workspace 标识、目录路径与显示名。
   */
  async create(): Promise<CreatedWorkspace> {
    const container = this.settings.tempDir
    // 首次使用时容器目录本身也可能不存在。
    await mkdir(container, { recursive: true })

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const path = join(container, `${this.settings.dirPrefix}${shortId()}`)
      try {
        // 不用 recursive，让重名以 EEXIST 暴露以便换名重试。
        await mkdir(path)
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') continue
        throw error
      }
      const workspace = await this.registry().create(path)
      const workspaceId = String(workspace.id)
      // 先记录后返回：记录写入失败则不留无法删除的目录。
      await this.records().put(path, {
        path,
        createdAt: new Date().toISOString(),
        workspaceId,
      })
      return { workspaceId, path: workspace.path, title: workspace.title }
    }
    throw new Error(`could not allocate a unique temp directory name in ${MAX_ATTEMPTS} attempts`)
  }

  /**
   * 校验目标确实是本插件创建的临时目录。
   *
   * 授权看记录，边界看容器：沿用调用方给出的路径与解析软链后的路径各校验一次，
   * 避免经由软链删到容器之外。
   * @param target - 待删除目录的绝对路径。
   * @returns 校验结论；通过时给出可安全删除的真实路径。
   */
  private async verify(target: string): Promise<Verdict> {
    const container = this.settings.tempDir
    const wanted = resolve(target)

    if (wanted === container) return { ok: false, reason: 'refused-container' }
    if (!isInside(container, wanted)) return { ok: false, reason: 'refused-outside' }
    // 无记录即非本插件所建：记录是删除授权的唯一依据。
    if (this.records().get(wanted) === undefined) return { ok: false, reason: 'refused-unknown' }

    let realContainer: string
    try {
      realContainer = await realpath(container)
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { ok: false, reason: 'missing' }
      throw error
    }

    let realWanted: string
    try {
      realWanted = await realpath(wanted)
    } catch (error) {
      // 目录本就不在，等同于已删除，不必当作失败上报。
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { ok: false, reason: 'missing' }
      throw error
    }

    if (realWanted === realContainer) return { ok: false, reason: 'refused-container' }
    if (!isInside(realContainer, realWanted)) return { ok: false, reason: 'refused-outside' }
    // 软链解析后可能落在记录之外，此时按未登记处理。
    if (realWanted !== wanted && this.records().get(realWanted) === undefined) {
      return { ok: false, reason: 'refused-unknown' }
    }

    return { ok: true, path: realWanted }
  }

  /**
   * 删除一个本插件创建的临时目录，并移除其记录。
   *
   * `confirmDirDelete` 打开时先只做校验并回 `needs-confirm`，由界面确认后再带
   * `confirmed` 调用一次；关闭时直接删。是否弹提示因此完全由 Host 判定，Client
   * 只看结果码，不需要自己维护任何状态。
   * @param request - `path` 为待删除目录的绝对路径；`confirmed` 表示用户已确认。
   * @returns 删除结果码；越界或未登记的目标以 `refused-*` 拒绝，不会触碰磁盘。
   */
  async deleteDirectory(request: { path: string; confirmed?: boolean }): Promise<DeleteResult> {
    const verdict = await this.verify(request.path)
    // missing 不算失败：目录本就不在，与删除成功等价。
    if (!verdict.ok) {
      if (verdict.reason === 'missing') await this.records().delete(resolve(request.path))
      return { code: verdict.reason }
    }

    // 需要确认且尚未确认：只回码，不动磁盘。
    if (this.settings.confirmDirDelete && request.confirmed !== true) {
      return { code: 'needs-confirm' }
    }

    try {
      await rm(verdict.path, { recursive: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        await this.records().delete(verdict.path)
        return { code: 'missing' }
      }
      return { code: 'delete-failed', message: String((error as Error)?.message ?? error) }
    }
    // 删成就撤记录；撤失败只影响下次列表，不回滚已完成的删除。
    await this.records().delete(verdict.path)
    return { code: 'deleted' }
  }
}

/**
 * 机读的 Typert 贡献，供 Gateway 解析端点与参数。
 *
 * 参数 codec 必须为 `strict`（Client 侧 `requireStrictInputs` 强制要求）；结果都是
 * JSON 安全值，用 `src-json` 即可。`service` 取上面注册的 Service key。
 */
const CONTRIBUTION = {
  package: 'dsh-tmp-wks',
  face: 'host',
  schemas: [],
  invocations: [
    {
      id: 'dsh-tmp-wks#tmpWks/create',
      service: NAMESPACE,
      namespace: NAMESPACE,
      method: 'create',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: 'dsh-tmp-wks#tmpWks/list',
      service: NAMESPACE,
      namespace: NAMESPACE,
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: 'dsh-tmp-wks#tmpWks/getState',
      service: NAMESPACE,
      namespace: NAMESPACE,
      method: 'getState',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: 'dsh-tmp-wks#tmpWks/deleteDirectory',
      service: NAMESPACE,
      namespace: NAMESPACE,
      method: 'deleteDirectory',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'request',
          wire: 'request',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: 'dsh-tmp-wks#tmpWks/deleteDirectory:request',
            // 非空字符串，避免空路径被当成有效输入。
            create: () => z.object({ path: z.string().min(1), confirmed: z.boolean().optional() }),
          },
        },
      ],
      result: { mode: 'src-json' },
    },
  ],
  model: { services: [], events: [], objects: [] },
}

/** 声明依赖：注册贡献需要 `typert`，`dshHomePath` 与 `storageDomain` 在启动时即被读取。 */
export const inject = ['typert', 'dshHomePath', 'storageDomain']

/**
 * 挂载服务与 Remote 贡献。
 *
 * 服务直接以插件自身的 ctx 构造：`Service` 把自身注册到传进来的 ctx，若改用
 * `ctx.plugin()` 包一层，服务会落在子 fiber 上，Gateway 在根上下文查不到它，
 * 调用一律以 `gateway/service-unavailable` 失败。
 * @param ctx - 插件所在的 Cordis 上下文。
 * @param config - 可选的插件配置。
 */
export function apply(ctx: Context, config?: Config): void {
  const service = new TmpWksService(ctx, config)
  ctx.effect(() => () => void service.stop(), 'dsh-tmp-wks: service')

  ctx.effect(() => {
    const dispose = ctx.typert.register(CONTRIBUTION)
    return () => void dispose()
  }, 'dsh-tmp-wks: remote contribution')

  // 领域打开是异步的；失败时服务保持未启动，调用会以明确错误暴露而非静默放行。
  void service.start().catch((error: unknown) => {
    console.error('[dsh-tmp-wks] could not open the tmp_wks domain:', error)
  })
}