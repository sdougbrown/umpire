import type { ScorecardField } from '@umpire/core'
import type { JSX } from 'preact'

export const theme = {
  accent: '#5fafff',
  bg: '#121220',
  border: '#36364b',
  changed: '#87d7d7',
  disabled: '#ff5f5f',
  enabled: '#87d787',
  fair: '#ffd700',
  fg: '#e4e4e4',
  fgMuted: '#a8afc5',
  overlay: 'rgba(14, 14, 26, 0.96)',
  ruleDisables: '#ff5f5f',
  ruleEitherOf: '#5fd7ff',
  ruleEnabledWhen: '#d78fff',
  ruleFairWhen: '#ffd700',
  ruleOneOf: '#87d7d7',
  ruleRequires: '#5fafff',
  shadow: '0 18px 50px rgba(0, 0, 0, 0.42)',
  surface: '#1d1d2f',
  surfaceMuted: '#171726',
  surfaceRaised: '#25253b',
  unavailable: '#6c7288',
} as const

export const fontFamily = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace"

export function getFieldTone(
  field: ScorecardField<Record<string, { required?: boolean }>>,
) {
  if (!field.enabled) {
    return field.foul ? theme.disabled : theme.unavailable
  }

  if (!field.fair) {
    return theme.fair
  }

  if (field.changed) {
    return theme.changed
  }

  return theme.enabled
}

export function getRuleTone(rule: string) {
  if (rule === 'requires') {
    return theme.ruleRequires
  }

  if (rule === 'enabledWhen') {
    return theme.ruleEnabledWhen
  }

  if (rule === 'fair') {
    return theme.ruleFairWhen
  }

  if (rule === 'oneOf') {
    return theme.ruleOneOf
  }

  if (rule === 'eitherOf') {
    return theme.ruleEitherOf
  }

  if (rule === 'disables') {
    return theme.ruleDisables
  }

  return theme.accent
}

export function tabStyle(active: boolean): JSX.CSSProperties {
  return {
    appearance: 'none',
    background: active ? theme.accent : 'transparent',
    border: 'none',
    borderRadius: 6,
    color: active ? theme.bg : theme.fgMuted,
    cursor: 'pointer',
    fontFamily,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    lineHeight: 1,
    padding: '6px 10px',
    textTransform: 'uppercase',
    transition: 'background 140ms ease, color 140ms ease',
  }
}

export function sectionHeadingStyle(): JSX.CSSProperties {
  return {
    color: theme.fgMuted,
    fontFamily,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    margin: 0,
    textTransform: 'uppercase',
  }
}

export function pillStyle(color: string, muted = false): JSX.CSSProperties {
  return {
    alignItems: 'center',
    background: muted ? 'transparent' : `${color}18`,
    border: `1px solid ${color}55`,
    borderRadius: 999,
    color,
    display: 'inline-flex',
    fontFamily,
    fontSize: 10,
    gap: 6,
    letterSpacing: '0.06em',
    padding: '3px 8px',
    textTransform: 'uppercase',
  }
}

export function scrollPaneStyle(): JSX.CSSProperties {
  return {
    height: '100%',
    overflow: 'auto',
  }
}
