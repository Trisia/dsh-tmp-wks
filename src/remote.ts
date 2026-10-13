/**
 * Host Remote 调用封装，以及本地「本插件创建过哪些工作区」的登记。
 *
 * 登记同时保存 id 与路径：工作区行消失后无法再反查其目录路径。
 */

/** `ctx.remote.tmpWks` 的服务面。 */
export interface TempWksRemote {
  create(): Promise<{ ok: boolean; value?: CreatedWorkspace; error?: RemoteFailure }>
  deleteDirectory(request: { path: string }): Promise<{ ok: boolean; value?: { code: string }; error?: RemoteFailure }>
}

/** Host 返回的新建工作区信息。 */
export interface CreatedWorkspace {
  workspaceId: string
  path: string
  title: string
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

/** 本地登记项的存储键。 */
const OWNED_KEY = 'dsh-tmp-wks.owned'

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
 * 读取本地登记。
 * @returns 登记项数组；存储不可用或内容损坏时按空登记处理。
 */
export function readOwned(): Array<{ id: string; path?: string }> {
  try {
    const list = JSON.parse(globalThis.localStorage?.getItem(OWNED_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((record) => typeof record?.id === 'string') : []
  } catch {
    // 隐私模式等场景下 localStorage 可能抛错。
    return []
  }
}

/**
 * 覆盖写入本地登记。
 * @param records - 完整的新登记内容。
 */
export function writeOwned(records: Array<{ id: string; path?: string }>): void {
  try {
    globalThis.localStorage?.setItem(OWNED_KEY, JSON.stringify(records))
  } catch {
    // 写失败只影响下次启动的入口显示，不阻断当前操作。
  }
}

/**
 * 请求 Host 创建临时工作区，并把结果登记到本地。
 * @param remote - Remote 服务面；未挂载时为 undefined。
 * @returns 新建的工作区信息。
 */
export async function createTempWorkspace(remote: TempWksRemote | undefined): Promise<CreatedWorkspace> {
  if (remote === undefined) throw codedError('noHost')
  const created = unwrap(await remote.create())
  if (typeof created?.workspaceId !== 'string' || typeof created?.path !== 'string') {
    throw codedError('badResponse')
  }
  writeOwned([...readOwned(), { id: created.workspaceId, path: created.path }])
  return created
}

/**
 * 请求 Host 删除临时目录。
 * @param remote - Remote 服务面；未挂载时为 undefined。
 * @param path - 待删除目录的绝对路径。
 * @returns 结果码；无法调用时返回 `request-failed`。
 */
export async function deleteTempDirectory(remote: TempWksRemote | undefined, path: string): Promise<string> {
  if (remote === undefined) return 'request-failed'
  const value = unwrap(await remote.deleteDirectory({ path }))
  return typeof value?.code === 'string' ? value.code : 'request-failed'
}