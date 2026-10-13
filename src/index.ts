/**
 * Host 半：临时工作区的 Remote 服务。
 *
 * 创建（命名、建目录、注册 Workspace）与删除都在 Host 完成，Client 只发指令。
 * 名字与路径的生成规则因此不必跨端约定。
 */

import { mkdir, realpath, rm } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { randomInt } from 'node:crypto'
import { Service, type Context } from '@deepseek-ai/cordis'
import { bindTypertRemote } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'

/** Remote 命名空间；Client 侧服务键为 `remote.tmpWks`。 */
const NAMESPACE = 'tmpWks'

/** DSH home 下存放临时工作区的容器目录名。 */
const CONTAINER = 'tmp'

/** 临时目录名前缀；删除时据此识别本插件创建的目录。 */
const PREFIX = 'tmp-'

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

/** 删除结果码；`refused-*` 表示目标越界被拒。 */
export type DeleteCode =
  | 'deleted'
  | 'missing'
  | 'refused-container'
  | 'refused-outside'
  | 'refused-prefix'
  | 'delete-failed'

/** `deleteDirectory()` 的返回值。 */
export interface DeleteResult {
  code: DeleteCode
  /** 仅在 `delete-failed` 时给出，说明失败原因。 */
  message?: string
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
 * 校验目标确实是本插件创建的临时目录。
 *
 * 沿用调用方给出的路径与解析软链后的路径各校验一次，避免经由软链删到容器之外。
 * @param home - DSH home 绝对路径。
 * @param target - 待删除目录的绝对路径。
 * @returns 校验结论；通过时给出可安全删除的真实路径。
 */
async function verifyTempDir(home: string, target: string): Promise<Verdict> {
  const container = resolve(home, CONTAINER)
  const wanted = resolve(target)

  const reject = (base: string, candidate: string): DeleteCode | undefined => {
    if (candidate === base) return 'refused-container'
    if (!isInside(base, candidate)) return 'refused-outside'
    if (!basename(candidate).startsWith(PREFIX)) return 'refused-prefix'
    return undefined
  }

  const shallow = reject(container, wanted)
  if (shallow !== undefined) return { ok: false, reason: shallow }

  let realContainer: string
  let realWanted: string
  try {
    realContainer = await realpath(container)
    realWanted = await realpath(wanted)
  } catch (error) {
    // 目录本就不在，等同于已删除，不必当作失败上报。
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { ok: false, reason: 'missing' }
    throw error
  }

  const deep = reject(realContainer, realWanted)
  if (deep !== undefined) return { ok: false, reason: deep }

  return { ok: true, path: realWanted }
}

/**
 * 承载 Remote 方法的服务。
 *
 * Gateway 依据接收者的 `typertRemote` 绑定定位服务，因此必须是 Cordis Service。
 */
class TmpWksService extends Service {
  static inject = ['dshHomePath', 'workspaceRegistry']

  constructor(ctx: Context) {
    super(ctx, NAMESPACE)
    this.typertRemote = bindTypertRemote(this, NAMESPACE, { namespace: NAMESPACE })
  }

  /** 容器目录绝对路径。 */
  private container(): string {
    return resolve(this.ctx.dshHomePath(), CONTAINER)
  }

  /**
   * 创建临时工作区：生成未占用的目录名、建目录并登记为 Workspace。
   * @returns 新建的 Workspace 标识、目录路径与显示名。
   */
  async create(): Promise<CreatedWorkspace> {
    const container = this.container()
    // 首次使用时容器目录本身也可能不存在。
    await mkdir(container, { recursive: true })

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const path = join(container, `${PREFIX}${shortId()}`)
      try {
        // 不用 recursive，让重名以 EEXIST 暴露以便换名重试。
        await mkdir(path)
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') continue
        throw error
      }
      const workspace = await this.ctx.workspaceRegistry.create(path)
      return { workspaceId: String(workspace.id), path: workspace.path, title: workspace.title }
    }
    throw new Error(`could not allocate a unique temp directory name in ${MAX_ATTEMPTS} attempts`)
  }

  /**
   * 删除一个本插件创建的临时目录。
   * @param request - `path` 为待删除目录的绝对路径。
   * @returns 删除结果码；越界目标以 `refused-*` 拒绝，不会触碰磁盘。
   */
  async deleteDirectory(request: { path: string }): Promise<DeleteResult> {
    const verdict = await verifyTempDir(this.ctx.dshHomePath(), request.path)
    // missing 不算失败：目录本就不在，与删除成功等价。
    if (!verdict.ok) return { code: verdict.reason }

    try {
      await rm(verdict.path, { recursive: true })
      return { code: 'deleted' }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { code: 'missing' }
      return { code: 'delete-failed', message: String((error as Error)?.message ?? error) }
    }
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
            create: () => z.object({ path: z.string().min(1) }),
          },
        },
      ],
      result: { mode: 'src-json' },
    },
  ],
  model: { services: [], events: [], objects: [] },
}

/** 声明依赖：注册贡献需要 `typert`，`dshHomePath` 在 apply 期间即被读取。 */
export const inject = ['typert', 'dshHomePath']

/**
 * 挂载服务与 Remote 贡献。
 * @param ctx - 插件所在的 Cordis 上下文。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const fiber = ctx.plugin(TmpWksService)
    return () => void fiber.dispose()
  }, 'dsh-tmp-wks: service')

  ctx.effect(() => {
    const dispose = ctx.typert.register(CONTRIBUTION)
    return () => void dispose()
  }, 'dsh-tmp-wks: remote contribution')
}