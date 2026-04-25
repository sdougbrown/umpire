import { isObjectLike } from './guards.js'

type SetoidValue = { 'fantasy-land/equals': (other: unknown) => boolean }
type EqValue = { equals: (other: unknown) => boolean }

function hasFantasyLandEquals(value: object): value is SetoidValue {
  return (
    'fantasy-land/equals' in value &&
    typeof value['fantasy-land/equals'] === 'function'
  )
}

function hasEquals(value: object): value is EqValue {
  return 'equals' in value && typeof value.equals === 'function'
}

/**
 * Equality here is intentionally left-dispatched for change detection:
 * - first honor identity/Object.is
 * - then allow the previous value to define custom equality semantics
 *
 * We do not require symmetric `a.equals(b) && b.equals(a)` agreement here,
 * because this helper is used to decide whether a field value changed,
 * not to provide a general-purpose algebraic equality relation.
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }

  if (!isObjectLike(a)) {
    return false
  }

  if (hasFantasyLandEquals(a)) {
    return a['fantasy-land/equals'](b)
  }

  if (hasEquals(a)) {
    return a.equals(b)
  }

  return false
}
