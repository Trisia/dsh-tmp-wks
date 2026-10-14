/**
 * Host Remote 调用封装。
 *
 * 临时工作区的登记由 Host 持有（storage 领域），Client 不自存、不轮询任何状态：
 * 是否弹删除确认由 Host 的结果码决定，界面只负责呈现。
 */

/** `ctx.remote.tmpWks` 的服务面。 */
export interface TempWksRemote {
  create(): Promise<{ ok: boolean; value?: CreatedWorkspace; error?: RemoteFailure }>
  list(): Promise<{ ok: boolean; value?: string[]; error?: RemoteFailure }>
  getState(): Promise<{ ok: boolean; value?: TmpWksState; error?: RemoteFailure }>
  deleteDirectory(request: {
    path: string
    confirmed?: boolean
  }): Promise<{ ok: boolean; value?: { code: string }; error?: RemoteFailure }>
}

/** Host 返回的新建工作区信息。 */
export interface CreatedWorkspace {
  workspaceId: string
  path: string
  title: string
}

/** Host 侧的运行期配置快照。 */
export interface TmpWksState {
  tempDir: string
  dirPrefix: string
  confirmDirDelete: boolean
}

/** Host 侧的失败描述。 */
export interface RemoteFailure {
  code?: string
  message?: string
}

/** 带稳定 `code` 的错误，供上层按界面语言翻译。 */
interface CodedError extends Error {
  code?: string
}

/**
 * 构造带稳定 `code` 的错误。
 * @param code - 稳定的错误码，用于查文案。
 * @param message - 可选的原始描述。
 * @returns 附带 code 的错误对象。
 */
function codedError(code: string, message?: string): CodedError {
  const error: CodedError = new Error(message ?? code)
  error.code = code
  return error
}

/**
 * 把 Remote 结果折成「值或抛错」。
 *
 * Gateway 的 unary 调用永不 reject：载体故障也走 `ok: false` 分支，必须显式检查。
 * @param result - Remote 调用返回的结果信封。
 * @returns 成功时的业务值。
 */
function unwrap<T>(result: { ok: boolean; value?: T; error?: RemoteFailure } | undefined): T {
  if (result?.ok === true) return result.value as T
  const failure = result?.error
  throw codedError(failure?.code ?? 'remoteFailed', failure?.message)
}

/**
 * 请求 Host 创建临时工作区。
 *
 * 登记由 Host 完成，Client 无需再记任何东西。
 * @param remote - Remote 服务面；未挂载时为 undefined。
 * @returns 新建的工作区信息。
 */
export async function createTempWorkspace(remote: TempWksRemote | undefined): Promise<CreatedWorkspace> {
  if (remote === undefined) throw codedError('noHost')
  const created = unwrap(await remote.create())
  if (typeof created?.workspaceId !== 'string' || typeof created?.path !== 'string') {
    throw codedError('badResponse')
  }
  return created
}

/**
 * 读取本插件创建过、且仍存在于磁盘上的临时目录路径。
 * @param remote - Remote 服务面；未挂载时为 undefined。
 * @returns 路径数组；无法读取时返回空数组，调用方按「无」处理。
 */
export async function listTempDirs(remote: TempWksRemote | undefined): Promise<string[]> {
  if (remote === undefined) return []
  try {
    const rows = unwrap(await remote.list())
    return Array.isArray(rows) ? rows.filter((row): row is string => typeof row === 'string') : []
  } catch {
    // 读取失败不该让界面崩掉：空列表比抛错更贴近可用预期。
    return []
  }
}

/**
 * 读取 Host 侧的配置快照。
 * @param remote - Remote 服务面；未挂载时为 undefined。
 * @returns 配置快照；无法读取时为 undefined。
 */
export async function readState(remote: TempWksRemote | undefined): Promise<TmpWksState | undefined> {
  if (remote === undefined) return undefined
  try {
    return unwrap(await remote.getState())
  } catch {
    return undefined
  }
}

/**
 * 请求 Host 删除临时目录。
 *
 * Host 依据 `confirmDirDelete` 决定是否先回 `needs-confirm`：需要确认时它不会
 * 触碰磁盘，界面据此弹提示，确认后再带 `confirmed` 调一次。
 * @param remote - Remote 服务面；未挂载时为 undefined。
 * @param path - 待删除目录的绝对路径。
 * @param confirmed - 用户是否已确认连目录一起删。
 * @returns 结果码；无法调用时返回 `request-failed`。
 */
export async function deleteTempDirectory(
  remote: TempWksRemote | undefined,
  path: string,
  confirmed = false,
): Promise<string> {
  if (remote === undefined) return 'request-failed'
  const request = confirmed ? { path, confirmed: true } : { path }
  const value = unwrap(await remote.deleteDirectory(request))
  return typeof value?.code === 'string' ? value.code : 'request-failed'
}