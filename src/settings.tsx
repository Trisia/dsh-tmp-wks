/**
 * 「插件」页上本插件那一行的可视化配置页。
 *
 * 通过 `plugins.row.config` slot 注册，键为 `<包名>#<行 id>`。页面所有者只传
 * `view` 与 `form`，不传文案函数，因此这里自己注入 locale 取文案。
 *
 * 表单值来自页面所有者给出的 `ConfigPageForm`：它读 Host 已接受的值，写入走
 * 同一份修订栅栏，因此暂存草稿与并发写入都不会互相覆盖。
 */

import React from 'react'
import { Btn, MUTED } from './ui.js'
import { NS, fill, type Translate } from './i18n.js'
import { readState, type TempWksRemote } from './remote.js'

/**
 * 默认值，与 Host 侧 `config.ts` 保持一致，用于「恢复默认」。
 *
 * `tempDir` 的空串表示「未配置」：写入时按 `unset` 处理，撤销覆盖让 Host 重新
 * 取操作系统的临时目录。具体路径依赖运行环境，客户端无法自行推断，需要从
 * Host 的 `getState()` 读取，见 `hostTempDir`。
 */
const DEFAULTS = {
  tempDir: '',
  dirPrefix: 'tmp-',
  confirmDirDelete: true,
}

/** 前缀的合法形式：单个路径段。 */
const SEGMENT_PATTERN = /^(?!\.{1,2}$)[^/\\]+$/

/** 表单状态快照，与 `ConfigFormSnapshot` 的字段子集对应。 */
interface FormSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: Record<string, unknown> | undefined
  user: unknown
  revision: number | undefined
  writable: boolean
}

/** 一次路径寻址的写入操作，与 `SettingsPathOpView` 对应。 */
type PathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** 页面所有者传入的视图与表单。 */
interface SettingsProps {
  /** `summary` 只渲染一行摘要；`page` 渲染完整表单。 */
  view: 'summary' | 'page'
  /** Host 已接受的值与写入动作；Host 未暴露该命名空间时为 undefined。 */
  form?: {
    state: FormSnapshot
    mutate(ops: readonly PathOp[], revision?: number): Promise<boolean>
  }
  /** 读取 Host 服务面，用于取已物化的完整路径。 */
  getRemote: () => TempWksRemote | undefined
  /** 渲染机制按 `locale` 命名空间合成的当前语言文案函数。 */
  t: Translate
}

/**
 * 判断某字段是否被用户覆盖过。
 *
 * 覆盖与否看字段在 `user` 层中是否存在，而不是比较取值：与默认值相同的覆盖
 * 仍然是覆盖，比较取值看不出来。
 * @param user - Host 给出的原始用户层。
 * @param field - 字段名。
 * @returns 该字段被显式覆盖时为 true。
 */
function isOverridden(user: unknown, field: string): boolean {
  return typeof user === 'object' && user !== null && field in (user as Record<string, unknown>)
}

/**
 * 读取某字段的字符串取值。
 * @param value - Host 已接受的值。
 * @param field - 字段名。
 * @param fallback - 缺失或类型不符时的取值。
 * @returns 该字段的字符串取值。
 */
function readString(value: Record<string, unknown> | undefined, field: string, fallback: string): string {
  const found = value?.[field]
  return typeof found === 'string' ? found : fallback
}

/**
 * 读取某字段的布尔取值。
 * @param value - Host 已接受的值。
 * @param field - 字段名。
 * @param fallback - 缺失或类型不符时的取值。
 * @returns 该字段的布尔取值。
 */
function readBoolean(value: Record<string, unknown> | undefined, field: string, fallback: boolean): boolean {
  const found = value?.[field]
  return typeof found === 'boolean' ? found : fallback
}

/** 一行字段：标签、控件与可选提示。 */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      {children}
      {hint === undefined ? null : <span style={{ ...MUTED, fontSize: 11 }}>{hint}</span>}
    </label>
  )
}

/** 与主题一致的文本输入框。 */
const INPUT: React.CSSProperties = {
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontSize: 13,
}

/**
 * 可视配置页本体。
 *
 * 编辑只改本地草稿，点「保存」才整批写入：一次提交携带读到的修订号，
 * 并发改动因此不会被静默覆盖。
 */
export function SettingsPage({ view, form, getRemote, t }: SettingsProps) {
  const value = form?.state.value
  const status = form?.state.status ?? 'unavailable'

  const accepted = {
    tempDir: readString(value, 'tempDir', DEFAULTS.tempDir),
    dirPrefix: readString(value, 'dirPrefix', DEFAULTS.dirPrefix),
    confirmDirDelete: readBoolean(value, 'confirmDirDelete', DEFAULTS.confirmDirDelete),
  }

  const [draft, setDraft] = React.useState(accepted)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)
  /**
   * Host 已物化的完整路径，即「恢复默认」应当回填的值。
   *
   * 表单里的 `tempDir` 来自配置层，未配置时是空串；而默认值（操作系统临时目录）
   * 只有 Host 知道，因此这里向 Host 取一次。取不到时保持 undefined，此时「恢复
   * 默认」退回为清空输入框——语义不变（仍是撤销覆盖），只是不显示具体路径。
   */
  const [hostTempDir, setHostTempDir] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    let live = true
    void readState(getRemote()).then((state) => {
      if (live && typeof state?.tempDir === 'string' && state.tempDir.trim() !== '') {
        setHostTempDir(state.tempDir)
      }
    })
    return () => { live = false }
  }, [getRemote])

  // Host 值变化时重置草稿，保证页面显示的就是已接受值。
  React.useEffect(
    () => setDraft(accepted),
    [accepted.tempDir, accepted.dirPrefix, accepted.confirmDirDelete],
  )

  if (status === 'unavailable') {
    return <div style={{ ...MUTED, fontSize: 13 }}>{t('settings.unavailable')}</div>
  }

  /**
   * 配置未覆盖时实际生效的目录：能取到 Host 物化的路径就用它，否则退回一句说明
   * （此时 `{value}` 留空，避免把占位符原样显示出来）。
   */
  const effectiveTempDir = hostTempDir ?? fill(t('settings.tempDir.osDefault'), { value: '' })

  if (view === 'summary') {
    // 未配置时不能显示空值：那一行的含义是「系统临时目录」，而非「没有位置」。
    const shown = accepted.tempDir.trim() === '' ? effectiveTempDir : accepted.tempDir
    return <div style={{ ...MUTED, fontSize: 12 }}>{fill(t('settings.current'), { value: shown })}</div>
  }

  /**
   * 把草稿里的目录取值折算成语义选择，用于判断「有没有真的改动」。
   *
   * 「留空」与「等于 Host 默认路径」是同一件事的两种写法（后者来自「恢复默认」），
   * 都表示交回操作系统临时目录；把它们归一到同一个标记，才不会因为写法不同而
   * 误判为已修改。把判定收在一处，`dirty` 与 `save` 也不会对同一份草稿给出不同结论。
   * @param text - 草稿中的存放目录取值。
   * @returns 表示「交回系统临时目录」时为 `''`，否则为用户填写的路径。
   */
  const effectiveTempDirChoice = (text: string): string =>
    (text.trim() === '' || text === hostTempDir ? '' : text)

  const dirty = effectiveTempDirChoice(draft.tempDir) !== effectiveTempDirChoice(accepted.tempDir)
    || draft.dirPrefix !== accepted.dirPrefix
    || draft.confirmDirDelete !== accepted.confirmDirDelete
  const invalid = !SEGMENT_PATTERN.test(draft.dirPrefix)
  const locked = busy || form === undefined || !form.state.writable

  const save = () => {
    if (form === undefined || locked || invalid) return
    setBusy(true)
    setError(null)
    setSaved(false)
    // 三项一起提交：单独提交会让「前缀已改、目录未改」的中间态被落盘。
    const ops: PathOp[] = []
    // 目录为空表示「交回操作系统临时目录」，语义上是撤销覆盖而非写入空串：
    // 写入空串会在配置里留下一个显式空覆盖，让「未配置」与「配置为空」两种
    // 状态混在一起。这里用 unset 清除该字段，让它重新继承默认行为。
    if (effectiveTempDirChoice(draft.tempDir) !== effectiveTempDirChoice(accepted.tempDir)) {
      ops.push(effectiveTempDirChoice(draft.tempDir) === ''
        ? { op: 'unset', path: ['tempDir'] }
        : { op: 'set', path: ['tempDir'], value: draft.tempDir })
    }
    if (draft.dirPrefix !== accepted.dirPrefix) ops.push({ op: 'set', path: ['dirPrefix'], value: draft.dirPrefix })
    if (draft.confirmDirDelete !== accepted.confirmDirDelete) {
      ops.push({ op: 'set', path: ['confirmDirDelete'], value: draft.confirmDirDelete })
    }
    form.mutate(ops, form.state.revision).then(
      (ok) => {
        setBusy(false)
        // 被拒时 Host 会刷新最新值，草稿保留以免用户白改一遍。
        if (ok) setSaved(true)
        else setError(t('settings.rejected'))
      },
      (reason: Error) => {
        setBusy(false)
        setError(fill(t('delete.failed'), { message: String(reason?.message ?? reason) }))
      },
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 320 }}>
      <div style={{ ...MUTED, fontSize: 12 }}>{t('settings.desc')}</div>

      <Field label={t('settings.tempDir.label')} hint={t('settings.tempDir.hint')}>
        <input
          style={INPUT}
          value={draft.tempDir}
          disabled={locked}
          placeholder={t('settings.tempDir.placeholder')}
          onChange={(event) => setDraft({ ...draft, tempDir: event.target.value })}
        />
        {draft.tempDir.trim() === ''
          ? <span style={{ ...MUTED, fontSize: 11 }}>{fill(t('settings.tempDir.osDefault'), { value: effectiveTempDir })}</span>
          : null}
        {isOverridden(form?.state.user, 'tempDir')
          ? <span style={{ ...MUTED, fontSize: 11 }}>{t('settings.overridden')}</span>
          : null}
      </Field>

      <Field label={t('settings.dirPrefix.label')} hint={t('settings.dirPrefix.hint')}>
        <input
          style={{ ...INPUT, borderColor: invalid ? 'var(--dsw-alias-state-error-primary)' : undefined }}
          value={draft.dirPrefix}
          disabled={locked}
          onChange={(event) => setDraft({ ...draft, dirPrefix: event.target.value })}
        />
        {invalid
          ? <span style={{ ...MUTED, fontSize: 11, color: 'var(--dsw-alias-state-error-primary)' }}>{t('settings.invalidPrefix')}</span>
          : null}
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={draft.confirmDirDelete}
          disabled={locked}
          onChange={(event) => setDraft({ ...draft, confirmDirDelete: event.target.checked })}
        />
        <span>{t('settings.confirmDirDelete.label')}</span>
      </label>
      <div style={{ ...MUTED, fontSize: 11 }}>{t('settings.confirmDirDelete.hint')}</div>

      {error === null
        ? null
        : <div role="alert" style={{ ...MUTED, color: 'var(--dsw-alias-state-error-primary)' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {saved ? <span style={{ ...MUTED, alignSelf: 'center' }}>{t('settings.saved')}</span> : null}
        {/* 恢复默认：目录一栏回填 Host 物化的完整路径而不是空串，用户能看到默认值
            是什么；提交时仍按 unset 处理，见 `save`。取不到 Host 值时才留空。 */}
        <Btn
          variant="outline"
          disabled={locked}
          onClick={() => setDraft({ ...DEFAULTS, tempDir: hostTempDir ?? '' })}
        >
          {t('settings.reset')}
        </Btn>
        <Btn variant="primary" disabled={locked || !dirty || invalid} onClick={save}>
          {busy ? t('settings.saving') : t('settings.save')}
        </Btn>
      </div>
    </div>
  )
}

/** 本插件在 locale 服务中的命名空间，注册 slot 时用。 */
export { NS as SETTINGS_NS }