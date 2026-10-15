/**
 * Client 半：侧边栏「新建临时会话」按钮与临时工作区的事后清理提示。
 *
 * 只负责界面与呈现：不算路径、不生成目录名、不注册 Workspace、不碰磁盘，
 * 后端动作一律经 `ctx.remote.tmpWks`。是否弹提示由配置决定，删除授权由 Host
 * 按记录判定，本端只做「目录记录」与「工作区列表」的比对。
 */

import React from 'react'
import { Btn, Modal, MUTED } from './ui.js'
import { DICTS, NS, fill, type Translate } from './i18n.js'
import {
  createTempWorkspace,
  deleteTempDirectory,
  listTempDirs,
  readState,
  type TempWksRemote,
} from './remote.js'
import { TempIcon, buttonStyle } from './sidebar-button.js'
import { SettingsPage } from './settings.js'

/** 事后清理提示依赖的数据源。 */
export interface ManageDeps {
  workspaces: {
    /** 当前工作区列表快照，含每项的 `path` 与加载阶段。 */
    list: {
      getSnapshot(): {
        items: Array<{ workspaceId: string; path: string }>
        /** 首屏基线到达前为 `pending`；未就绪时不作判定。 */
        phase: 'pending' | 'ready'
      }
    }
  }
  getRemote: () => TempWksRemote | undefined
}

/**
 * 把结果码翻成一句人话。
 *
 * `refused-outside` 这类码取后半段查词典，命中就给具体解释，否则退回带码的
 * 通用文案，避免用户看到一串英文码却不知道发生了什么。
 * @param t - 文案查询函数。
 * @param code - Host 返回的结果码。
 * @returns 面向用户的说明。
 */
function explain(t: Translate, code: string): string {
  const key = `refuse.${code.split('-')[1] ?? ''}`
  const known = t(key)
  return known === key ? fill(t('delete.dirFailed'), { code }) : known
}

/**
 * 事后清理提示。
 *
 * 内置的工作区删除对话框不是 slot，既拦不住、也无法往它的确认框加控件，因此
 * 只能在删除发生后发现：订阅工作区列表，与 Host 的目录记录比对——出现过、
 * 如今从列表消失的临时目录，就是被内置入口删掉了工作区。
 *
 * 是否弹提示由配置 `confirmDirDelete` 决定；关闭时不给提示，目录留在磁盘上。
 */
function CleanupPrompt({ t, deps }: { t: Translate; deps: ManageDeps }) {
  const [pending, setPending] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [enabled, setEnabled] = React.useState(false)
  /** 已经提示过、或首屏就已孤立的目录；避免重复打扰。 */
  const prompted = React.useRef(new Set<string>())
  /** 是否已用首屏数据建立过基准。 */
  const primed = React.useRef(false)

  React.useEffect(() => {
    let live = true
    void readState(deps.getRemote()).then((state) => { if (live) setEnabled(state?.confirmDirDelete ?? true) })
    return () => { live = false }
  }, [deps])

  React.useEffect(() => {
    if (!enabled) return undefined
    let live = true

    /**
     * 同步一次「目录记录 ↔ 工作区列表」，并找出刚被外部删除的工作区。
     *
     * 判定分两步，避免把两种情况误当成「用户刚删了工作区」：
     *
     * 1. 首屏已经存在的孤儿目录（记录里有、工作区列表里没有）不作提示——用户
     *    并没有做任何删除动作，多数是上次保留了目录或列表本就还没建立。
     * 2. 之后才失去工作区的目录才算刚被删除。
     *
     * 因此第一次比对只用来记下基准，不产生提示；如果删除恰好发生在基线到达
     * 之前，那次删除会被并入基准而漏掉提示，这是为「启动不误报」付出的代价。
     */
    const tick = async () => {
      const snapshot = deps.workspaces.list.getSnapshot()
      // 列表没加载完就先不判定，否则「还没到」会被当成「被删了」。
      if (snapshot.phase !== 'ready') return

      const paths = await listTempDirs(deps.getRemote())
      if (!live) return

      const orphaned = paths.filter((path) => !snapshot.items.some((item) => item.path === path))
      // 首次比对只建立基准：此时已存在的孤儿目录不提示。
      if (!primed.current) {
        primed.current = true
        for (const path of orphaned) prompted.current.add(path)
        return
      }

      const gone = orphaned.find((path) => !prompted.current.has(path))
      if (gone !== undefined) {
        // 记下以免反复提示；用户选择「保留」后也不再重复打扰。
        prompted.current.add(gone)
        setPending(gone)
      }
    }

    void tick()
    const timer = globalThis.setInterval(() => void tick(), 2000)
    return () => { live = false; globalThis.clearInterval(timer) }
  }, [deps, enabled])

  if (pending === null) return null

  /** 关闭提示；`clean` 为真时请求 Host 删除目录。 */
  const settle = async (clean: boolean) => {
    if (!clean) {
      setPending(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const code = await deleteTempDirectory(deps.getRemote(), pending, true)
      if (code !== 'deleted' && code !== 'missing') {
        setError(explain(t, code))
        return
      }
      setPending(null)
    } catch (reason) {
      setError(fill(t('delete.failed'), { message: String((reason as Error)?.message ?? reason) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      onClose={() => { if (!busy) void settle(false) }}
      title={t('cleanup.title')}
      description={fill(t('cleanup.desc'), { name: pending })}
      footer={<>
        <Btn disabled={busy} onClick={() => void settle(false)}>{t('cleanup.keep')}</Btn>
        <Btn variant="primary" disabled={busy} onClick={() => void settle(true)}>{t('cleanup.confirm')}</Btn>
      </>}
    >
      <div style={{ ...MUTED, wordBreak: 'break-all' }}>{pending}</div>
      {busy ? <div role="status" style={{ ...MUTED, marginTop: 10 }}>{t('delete.pending')}</div> : null}
      {error === null
        ? null
        : <div role="alert" style={{ ...MUTED, marginTop: 10, color: 'var(--dsw-alias-state-error-primary)' }}>{error}</div>}
    </Modal>
  )
}

/**
 * 本插件 Client 侧的 Remote 贡献，与 Host 的 `ctx.typert.register()` 一一对应。
 *
 * 只声明端点；`namespace` 决定挂载后的服务键 `remote.tmpWks`。参数 codec 必须
 * `strict`（Client 侧 `requireStrictInputs` 强制），这里只做参数装配，故校验器从简。
 */
const CONTRIBUTION = {
  package: 'dsh-tmp-wks',
  descriptors: [
    {
      id: 'dsh-tmp-wks#tmpWks/create',
      service: 'tmpWks',
      namespace: 'tmpWks',
      method: 'create',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: 'dsh-tmp-wks#tmpWks/list',
      service: 'tmpWks',
      namespace: 'tmpWks',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: 'dsh-tmp-wks#tmpWks/getState',
      service: 'tmpWks',
      namespace: 'tmpWks',
      method: 'getState',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: 'dsh-tmp-wks#tmpWks/deleteDirectory',
      service: 'tmpWks',
      namespace: 'tmpWks',
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
            create: () => ({ parse: (value: unknown) => value }),
          },
        },
      ],
      result: { mode: 'src-json' },
    },
  ],
}

/**
 * 侧边栏按钮：创建临时工作区并进入会话。
 */
function NewTempSessionButton({ wide, getRemote, uiWorkspace, t }: {
  wide: boolean
  getRemote: () => TempWksRemote | undefined
  uiWorkspace: { startSession(id: string): void }
  t: Translate
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const label = error ?? (busy ? t('action.creating') : t('action.create'))

  const onClick = React.useCallback(() => {
    if (busy) return
    setBusy(true)
    setError(null)
    createTempWorkspace(getRemote()).then(
      (created) => {
        setBusy(false)
        // 目录与 Workspace 均由 Host 备好，这里只负责导航。
        uiWorkspace.startSession(created.workspaceId)
      },
      (reason: { code?: string; message?: string }) => {
        setBusy(false)
        // 带 code 的是本插件自己的错误，按界面语言翻译；其余原样显示 Host 文案。
        setError(reason?.code === undefined ? String(reason?.message ?? reason) : t(`error.${reason.code}`))
      },
    )
  }, [busy, getRemote, uiWorkspace, t])

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      style={buttonStyle(wide, busy)}
    >
      <TempIcon />
      {wide ? <span>{label}</span> : null}
    </button>
  )
}

/**
 * Client 半入口，由 Vite 打包成单文件 bundle。
 * @param ctx - Client 侧根上下文。
 */
export function apply(ctx: any): void {
  ctx.effect(() => ctx.locale.register(NS, 'zh', DICTS.zh), 'dsh-tmp-wks: zh dictionary')
  ctx.effect(() => ctx.locale.register(NS, 'en', DICTS.en), 'dsh-tmp-wks: en dictionary')

  ctx.effect(async () => {
    try {
      const dispose = await ctx.remote.$mount(CONTRIBUTION)
      return () => void dispose()
    } catch (error) {
      // 挂载失败必须显性化：否则只表现为「宿主不支持」这种误导性文案。
      console.error('[dsh-tmp-wks] $mount failed:', error)
      throw error
    }
  }, 'dsh-tmp-wks: remote methods')

  // 挂载是异步的，而 slot 的 inject 返回值会被缓存，因此注入取值函数、调用时才解析。
  const remote = (): TempWksRemote | undefined => ctx.get(`remote.tmpWks`)

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'new-temp-session',
    order: 50,
    locale: NS,
    inject: () => ({
      getRemote: remote,
      uiWorkspace: ctx.uiWorkspace,
    }),
  }, NewTempSessionButton))

  // 事后清理提示：订阅工作区列表，发现目录的工作区被删掉时就地问一句。
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'temp-workspace-cleanup',
    order: 300,
    locale: NS,
    inject: () => ({
      deps: { workspaces: { list: ctx.workspaces.list }, getRemote: remote },
    }),
  }, CleanupPrompt))

  // 可视配置页：挂在「插件」页本插件那一行上，键为 `<包名>#<行 id>`。
  // 页面所有者只传 view 与 form；`t` 由渲染机制按 locale 命名空间合成。
  // `getRemote` 用于读取 Host 已物化的完整路径，供「恢复默认」回填。
  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
    name: 'plugins.row.config',
    key: `${PKG}#${ROW_ID}`,
    locale: NS,
    inject: () => ({ getRemote: remote }),
  }, SettingsPage))
}

/** 本包名，用于拼 `plugins.row.config` 的键。 */
const PKG = '@cliven/dsh-tmp-wks'

/** Loader 补丁里的行 id，见 `cordis.patch.yml`。 */
const ROW_ID = 'local-dsh-tmp-wks'

/** 所需 Client 服务；加载器读取此声明而非对象字面量导出。 */
export const inject = ['slots', 'uiWorkspace', 'workspaces', 'locale', 'remote', 'typert']