import { useMemo, useRef } from 'react'
import type {
  AvailabilityMap,
  FieldDef,
  FieldValues,
  ResetRecommendation,
  Snapshot,
  Umpire,
} from '@umpire/core'

export function useUmpire<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  ump: Umpire<F, C>,
  values: FieldValues<F>,
  context?: C,
): {
  check: AvailabilityMap<F>
  penalties: ResetRecommendation<F>[]
} {
  const prevRef = useRef<Snapshot<F, C> | undefined>(undefined)

  const check = useMemo(
    () => ump.check(values, context, prevRef.current?.values),
    [ump, values, context],
  )

  const penalties = useMemo(() => {
    const prev = prevRef.current
    if (!prev) {
      return []
    }
    return ump.flag(prev, { values, context })
  }, [ump, values, context])

  // Update prev ref after computing check and penalties
  prevRef.current = { values, context }

  return { check, penalties }
}
