import { useDebugValue, useMemo, useRef } from 'react'
import type {
  AvailabilityMap,
  FieldDef,
  InputValues,
  Foul,
  Snapshot,
  Umpire,
} from '@umpire/core'

export function useUmpire<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  ump: Umpire<F, C>,
  values: InputValues<F>,
  conditions?: C,
): {
  check: AvailabilityMap<F>
  fouls: Foul<F>[]
} {
  const prevRef = useRef<Snapshot<F, C> | undefined>(undefined)

  const check = useMemo(
    () => ump.check(values, conditions, prevRef.current?.values),
    [ump, values, conditions],
  )

  const fouls = useMemo(() => {
    const prev = prevRef.current
    if (!prev) {
      return []
    }
    return ump.play(prev, { values, conditions })
  }, [ump, values, conditions])

  // Update prev ref after computing check and fouls
  prevRef.current = { values, conditions }

  useDebugValue({ check, fouls }, ({ check, fouls }) => ({
    enabled: Object.entries(check)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k),
    disabled: Object.entries(check)
      .filter(([, v]) => !v.enabled)
      .map(([k]) => k),
    fouls: fouls.map((f) => f.field),
  }))

  return { check, fouls }
}
