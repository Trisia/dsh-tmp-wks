/** 侧边栏「新建临时会话」按钮的图标与样式。 */

import React from 'react'

/** 虚线方框加号；用 currentColor 跟随主题。 */
export function TempIcon() {
  return (
    <svg
      width={16} height={16} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden style={{ flex: '0 0 auto' }}
    >
      <rect x={2} y={2} width={12} height={12} rx={2} strokeDasharray="2.5 2" />
      <path d="M8 5.5v5M5.5 8h5" />
    </svg>
  )
}

/**
 * 侧边栏按钮样式。
 * @param wide - 侧边栏展开时左对齐显示文字，收起时只留图标。
 * @param busy - 创建中时降低不透明度并禁用指针。
 * @returns 按钮的行内样式。
 */
export function buttonStyle(wide: boolean, busy: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: wide ? 'flex-start' : 'center',
    gap: 8,
    width: '100%',
    minHeight: 32,
    padding: wide ? '0 8px' : 0,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontSize: 13,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
    textAlign: 'left',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }
}