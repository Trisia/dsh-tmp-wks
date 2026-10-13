/**
 * Client 半：侧边栏「新建临时会话」按钮与临时工作区管理面板。
 *
 * 只负责界面与导航：不算路径、不生成目录名、不注册 Workspace、不碰磁盘，
 * 后端动作一律经 `ctx.remote.tmpWks`。
 */

import React from 'react'
import { Btn, Check, Modal, MUTED } from './ui.js'
import { DICTS, NS, fill, type Translate } from './i18n.js'
import { createTempWorkspace, deleteTempDirectory, readOwned, writeOwned, type TempWksRemote } from './remote.js'
import { TempIcon, buttonStyle } from './sidebar-button.js'

/** 管理面板依赖的工作区数据源。 */
export interface ManageDeps {
  workspaces: {
    /** 当前工作区列表快照，含 `items`。 */
    list: {
      getSnapshot(): { items: Array<{ workspaceId: string; title: string; path: string }> }
      subscribe(listener: () => void): () => void
    }
    /** 仅移除列表中的登记，保留磁盘目录。 */
    delete(id: string): Promise<void>
  }
  getRemote: () => TempWksRemote | undefined
}

/** 管理面板自己删掉的工作区 id；补救提示跳过它们，避免重复提示。 */
const selfDeleted = new Set<string>()

function DeleteDialog({ workspaceId, title, path, t, onClose, onDone }: {
  workspaceId: string
  title: string
  path: string
  t: Translate
  onClose: () => void
  onDone: (req: { workspaceId: string; path: string; removeDir: boolean }) => Promise<{ failed?: string }>
}) {
  // 默认不勾选：内置删除语义是「只移除登记、保留目录」，默认勾选会让人在不知情下丢数据。
  const [removeDir, setRemoveDir] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const close = () => { if (!busy) onClose() }

  const confirm = () => {
    setBusy(true)
    setError(null)
    onDone({ workspaceId, path, removeDir }).then(
      (outcome) => {
        setBusy(false)
        if (outcome?.failed === undefined) onClose()
        else setError(fill(t('delete.failed'), { message: outcome.failed }))
      },
      (reason: Error) => {
        setBusy(false)
        setError(fill(t('delete.failed'), { message: String(reason?.message ?? reason) }))
      },
    )
  }

  return (
    <Modal
      onClose={close}
      title={t('delete.title')}
      description={fill(t('delete.desc'), { name: title })}
      footer={<>
        <Btn disabled={busy} onClick={close}>{t('manage.cancel')}</Btn>
        <Btn variant="primary" disabled={busy} onClick={confirm}>{t('delete.title')}</Btn>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Check checked={removeDir} onChange={setRemoveDir} disabled={busy} label={t('delete.removeDir')} />
        {removeDir ? <div style={{ ...MUTED, wordBreak: 'break-all' }}>{fill(t('delete.dirHint'), { path })}</div> : null}
        {busy ? <div role="status" style={MUTED}>{t('delete.pending')}</div> : null}
        {error === null ? null : <div role="alert" style={{ ...MUTED, color: 'var(--dsw-alias-state-error-primary)' }}>{error}</div>}
      </div>
    </Modal>
  )
}

function ManagePanel({ t, onClose, deps }: { t: Translate; onClose: () => void; deps: ManageDeps }) {
  const [snapshot, setSnapshot] = React.useState(() => deps.workspaces.list.getSnapshot())
  const [target, setTarget] = React.useState<{ workspaceId: string; title: string; path: string } | null>(null)
  // 列表数据不携带来源，靠本地登记区分哪些是本插件创建的；登记随删除变化，故需状态驱动重渲染。
  const [owned, setOwned] = React.useState(readOwned)

  React.useEffect(
    () => deps.workspaces.list.subscribe(() => setSnapshot(deps.workspaces.list.getSnapshot())),
    [deps],
  )

  const rows = snapshot.items.filter(
    (item) => owned.some((record) => String(record.id) === String(item.workspaceId)),
  )

  /** 先移除登记，再按勾选决定是否删目录。 */
  const runDelete = async ({ workspaceId, path, removeDir }: { workspaceId: string; path: string; removeDir: boolean }) => {
    // 标记为面板所删，避免事后补救提示把同一次删除再报一遍。
    selfDeleted.add(String(workspaceId))
    try {
      await deps.workspaces.delete(workspaceId)
      const kept = readOwned().filter((record) => record.id !== workspaceId)
      writeOwned(kept)
      setOwned(kept)
    } catch (reason) {
      return { failed: String((reason as Error)?.message ?? reason) }
    }
    if (!removeDir) return {}
    const code = await deleteTempDirectory(deps.getRemote(), path)
    return code === 'deleted' || code === 'missing'
      ? {}
      : { failed: fill(t('delete.dirFailed'), { code }) }
  }

  return (
    <Modal
      onClose={onClose}
      title={t('manage.title')}
      footer={<Btn onClick={onClose}>{t('manage.close')}</Btn>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 320 }}>
        {rows.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary)' }}>{t('manage.empty')}</div>
          : rows.map((item) => (
            <div
              key={String(item.workspaceId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                background: 'var(--dsw-alias-bg-layer-2)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.path}</div>
              </div>
              <Btn onClick={() => setTarget(item)}>{t('manage.delete')}</Btn>
            </div>
          ))}
        {target === null ? null : (
          <DeleteDialog
            workspaceId={target.workspaceId}
            title={target.title}
            path={target.path}
            t={t}
            onClose={() => setTarget(null)}
            onDone={runDelete}
          />
        )}
      </div>
    </Modal>
  )
}

/**
 * 事后补救提示：内置删除按钮移除了登记，但临时目录可能仍在磁盘上。
 *
 * 内置的工作区删除按钮不是 slot，既无法拦截、也无法往它的确认框加控件，
 * 只能在删除发生后对比登记与列表来发现。
 */
function CleanupPrompt({ deps, t }: { deps: ManageDeps; t: Translate }) {
  const [pending, setPending] = React.useState<string | null>(null)

  React.useEffect(() => {
    const check = () => {
      const live = new Set(deps.workspaces.list.getSnapshot().items.map((item) => String(item.workspaceId)))
      const records = readOwned()
      const liveRecords = records.filter((record) => live.has(String(record.id)))
      const missing = records.find(
        (record) => !live.has(String(record.id))
          && typeof record.path === 'string'
          && !selfDeleted.has(String(record.id)),
      )
      // 先注销登记以免反复提示；目录是否清理交给用户决定。
      if (liveRecords.length !== records.length) writeOwned(liveRecords)
      if (missing !== undefined) setPending(missing.path ?? null)
    }
    check()
    return deps.workspaces.list.subscribe(check)
  }, [deps])

  if (pending === null) return null

  const settle = (clean: boolean) => {
    setPending(null)
    if (clean) void deleteTempDirectory(deps.getRemote(), pending)
  }

  return (
    <Modal
      onClose={() => settle(false)}
      title={t('cleanup.title')}
      description={fill(t('cleanup.desc'), { name: pending })}
      footer={<>
        <Btn onClick={() => settle(false)}>{t('cleanup.keep')}</Btn>
        <Btn variant="primary" onClick={() => settle(true)}>{t('cleanup.confirm')}</Btn>
      </>}
    >
      <div style={{ ...MUTED, wordBreak: 'break-all' }}>{pending}</div>
    </Modal>
  )
}

/** 管理面板开关：模块级单例，由侧边栏按钮写入、浮层条目读取。 */
const manager = { open: false, listeners: new Set<() => void>() }

/** 通知所有浮层条目重新读取开关状态。 */
function notifyManager(): void {
  for (const listener of manager.listeners) listener()
}

/** 由侧边栏按钮调用：打开管理面板。 */
function openManager(): void {
  manager.open = true
  notifyManager()
}

/** 由浮层条目调用：关闭管理面板。 */
function closeManager(): void {
  manager.open = false
  notifyManager()
}

/**
 * 订阅管理面板开关。
 * @param listener - 开关变化时被调用。
 * @returns 取消订阅函数。
 */
function subscribeManager(listener: () => void): () => void {
  manager.listeners.add(listener)
  return () => void manager.listeners.delete(listener)
}

function ManagerOverlay({ deps, onClose, t }: { deps: ManageDeps; onClose: () => void; t: Translate }) {
  const [open, setOpen] = React.useState(manager.open)
  React.useEffect(() => {
    const sync = () => setOpen(manager.open)
    sync()
    return subscribeManager(sync)
  }, [])
  return open ? <ManagePanel t={t} onClose={onClose} deps={deps} /> : null
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
 * 侧边栏按钮：左键创建临时工作区并进入会话，右键打开管理面板。
 */
function NewTempSessionButton({ wide, getRemote, uiWorkspace, t, openManager }: {
  wide: boolean
  getRemote: () => TempWksRemote | undefined
  uiWorkspace: { startSession(id: string): void }
  t: Translate
  openManager: () => void
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
      // 右键打开管理面板，不占用左键的主路径。
      onContextMenu={(event) => { event.preventDefault(); openManager() }}
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
      openManager,
    }),
  }, NewTempSessionButton))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'temp-workspace-manager',
    order: 300,
    locale: NS,
    inject: () => ({
      deps: { workspaces: ctx.workspaces, getRemote: remote },
      onClose: closeManager,
    }),
  }, ManagerOverlay))

  // 补救提示独立成条：内置删除按钮移除登记后，目录可能仍在磁盘上。
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'temp-workspace-cleanup',
    order: 310,
    locale: NS,
    inject: () => ({ deps: { workspaces: ctx.workspaces, getRemote: remote } }),
  }, CleanupPrompt))
}

/** 所需 Client 服务；加载器读取此声明而非对象字面量导出。 */
export const inject = ['slots', 'uiWorkspace', 'workspaces', 'locale', 'remote', 'typert']