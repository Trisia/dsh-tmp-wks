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

/** 默认值，与 Host 侧 `config.ts` 保持一致，用于「恢复默认」。 */
const DEFAULTS = {
  tempDir: 'tmp',
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
export function SettingsPage({ view, form, t }: SettingsProps) {
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

  // Host 值变化时重置草稿，保证页面显示的就是已接受值。
  React.useEffect(
    () => setDraft(accepted),
    [accepted.tempDir, accepted.dirPrefix, accepted.confirmDirDelete],
  )

  if (status === 'unavailable') {
    return <div style={{ ...MUTED, fontSize: 13 }}>{t('settings.unavailable')}</div>
  }

  if (view === 'summary') {
    return <div style={{ ...MUTED, fontSize: 12 }}>{fill(t('settings.current'), { value: accepted.tempDir })}</div>
  }

  const dirty = draft.tempDir !== accepted.tempDir
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
    if (draft.tempDir !== accepted.tempDir) ops.push({ op: 'set', path: ['tempDir'], value: draft.tempDir })
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
          onChange={(event) => setDraft({ ...draft, tempDir: event.target.value })}
        />
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
        {/* 恢复默认就是清除覆盖，让字段重新继承组合层。 */}
        <Btn variant="outline" disabled={locked} onClick={() => setDraft({ ...DEFAULTS })}>
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