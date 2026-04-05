import { useEffectEvent, useMemo, useState } from 'react'
import type { CoachRuntime, CoachRuntimeState } from './createCoachRuntime.ts'

export function useCoachRuntime<
  FactId extends string,
  PromptId extends string,
>(
  runtime: CoachRuntime<FactId, PromptId>,
) {
  const [state, setState] = useState<CoachRuntimeState<FactId, PromptId>>(() => runtime.init())

  const rememberFacts = useEffectEvent((next: Partial<Record<FactId, boolean>>) => {
    setState((current) => runtime.rememberFacts(current, next))
  })

  const markPromptShown = useEffectEvent((promptId: PromptId) => {
    setState((current) => runtime.markPromptShown(current, promptId))
  })

  const dismissPrompt = useEffectEvent((promptId: PromptId) => {
    setState((current) => runtime.dismissPrompt(current, promptId))
  })

  return {
    dismissPrompt,
    facts: state.facts,
    markPromptShown,
    rememberFacts,
    state,
  }
}

export function useResolvedCoachPrompts<
  FactId extends string,
  PromptId extends string,
>(
  runtime: CoachRuntime<FactId, PromptId>,
  state: CoachRuntimeState<FactId, PromptId>,
  eligibility: Partial<Record<PromptId, boolean>>,
) {
  return useMemo(
    () => runtime.resolvePrompts(state, eligibility),
    [eligibility, runtime, state],
  )
}
