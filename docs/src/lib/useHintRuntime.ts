import { useEffectEvent, useMemo, useState } from 'react'
import type { HintRuntime, HintRuntimeState } from './createHintRuntime.ts'

export function useHintRuntime<
  FactId extends string,
  HintId extends string,
>(
  runtime: HintRuntime<FactId, HintId>,
) {
  const [state, setState] = useState<HintRuntimeState<FactId, HintId>>(() => runtime.init())

  const rememberFacts = useEffectEvent((next: Partial<Record<FactId, boolean>>) => {
    setState((current) => runtime.rememberFacts(current, next))
  })

  const markHintShown = useEffectEvent((hintId: HintId) => {
    setState((current) => runtime.markHintShown(current, hintId))
  })

  const dismissHint = useEffectEvent((hintId: HintId) => {
    setState((current) => runtime.dismissHint(current, hintId))
  })

  return {
    dismissHint,
    facts: state.facts,
    hints: state.hints,
    markHintShown,
    rememberFacts,
    state,
  }
}

export function useResolvedHints<
  FactId extends string,
  HintId extends string,
>(
  runtime: HintRuntime<FactId, HintId>,
  state: HintRuntimeState<FactId, HintId>,
  eligibility: Partial<Record<HintId, boolean>>,
) {
  return useMemo(
    () => runtime.resolveHints(state, eligibility),
    [eligibility, runtime, state],
  )
}
