/** 管理面板与弹层共用的基础控件。 */

import React from 'react'

/** 次要说明文字样式。 */
export const MUTED: React.CSSProperties = { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }

/** 弹层遮罩。 */
const MASK: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  // `shell.overlay` 本身是点击穿透层，必须显式打开，否则会拦住整个应用的点击。
  pointerEvents: 'auto',
  background: 'var(--dsw-alias-bg-overlay)',
}

const CARD: React.CSSProperties = {
  minWidth: 360,
  maxWidth: '90vw',
  maxHeight: '80vh',
  overflow: 'auto',
  padding: 16,
  borderRadius: 12,
  background: 'var(--dsw-alias-bg-layer-1)',
  border: '1px solid var(--dsw-alias-border-l2)',
  color: 'var(--dsw-alias-label-primary)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
}

/** 同层多个弹层若共用 z-index，内层无法盖住外层，故按打开顺序递增。 */
let openModals = 0

/** 弹层基础层级。 */
const MASK_BASE_Z = 1000

/** 分配一个新的弹层层级，单位：z-index 数值。 */
function nextZ(): number {
  return MASK_BASE_Z + (openModals + 1) * 10
}

/**
 * 弹层容器：遮罩 + 卡片 + 键盘与焦点处理。
 * @param props.title - 标题，同时作为无障碍名称。
 * @param props.description - 可选的说明文字。
 * @param props.footer - 底部操作区。
 * @param props.onClose - 关闭回调，由 Esc、点击遮罩或调用方触发。
 * @param props.children - 卡片主体内容。
 */
export function Modal({ title, description, footer, onClose, children }: {
  title: string
  description?: string
  footer?: React.ReactNode
  onClose: () => void
  children?: React.ReactNode
}) {
  const cardRef = React.useRef<HTMLDivElement>(null)
  // 固定首次分配的层级，避免重渲染时跳层导致外层盖住内层。
  const zRef = React.useRef(0)
  if (zRef.current === 0) zRef.current = nextZ()

  React.useEffect(() => {
    openModals += 1
    return () => { openModals -= 1 }
  }, [])

  React.useEffect(() => {
    const previous = globalThis.document?.activeElement
    cardRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    globalThis.document?.addEventListener('keydown', onKeyDown)
    return () => {
      globalThis.document?.removeEventListener('keydown', onKeyDown)
      // 关闭后把焦点还给打开它的元素。
      if (previous instanceof globalThis.HTMLElement && globalThis.document?.contains(previous)) {
        previous.focus()
      }
    }
  }, [onClose])

  return (
    <div
      style={{ ...MASK, zIndex: zRef.current }}
      // 只在遮罩自身被点击时关闭，避免卡片内部冒泡导致误关。
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div ref={cardRef} role="dialog" aria-modal aria-label={title} tabIndex={-1} style={{ ...CARD, outline: 'none' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{title}</div>
        {description === undefined ? null : <div style={{ ...MUTED, marginBottom: 12 }}>{description}</div>}
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>{footer}</div>
      </div>
    </div>
  )
}

/**
 * 弹层内的操作按钮。
 * @param props.variant - `primary` 为主题色实心，默认描边。
 * @param props.disabled - 禁用时不响应点击。
 * @param props.onClick - 点击回调。
 */
export function Btn({ variant = 'outline', disabled = false, onClick, children }: {
  variant?: 'outline' | 'primary'
  disabled?: boolean
  onClick?: () => void
  children?: React.ReactNode
}) {
  const primary = variant === 'primary'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 6,
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        border: primary ? 'none' : '1px solid var(--dsw-alias-border-l2)',
        background: primary ? 'var(--dsw-alias-button-primary-fill)' : 'transparent',
        color: primary ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-label-primary)',
        font: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

/**
 * 带说明文字的复选框。
 * @param props.checked - 当前是否勾选。
 * @param props.disabled - 禁用时不可切换。
 * @param props.label - 说明文字。
 * @param props.onChange - 勾选状态变化回调。
 */
export function Check({ checked, disabled = false, label, onChange }: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'inherit' }}
      />
      <span>{label}</span>
    </label>
  )
}