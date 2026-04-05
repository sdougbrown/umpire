export type CoachFacts<K extends string> = Record<K, boolean>

export type CoachPromptState<K extends string> = Record<
  K,
  {
    dismissed: boolean
    shown: boolean
  }
>

export type CoachRuntimeState<
  FactId extends string,
  PromptId extends string,
> = {
  facts: CoachFacts<FactId>
  prompts: CoachPromptState<PromptId>
}

export type CoachPromptConfig<PromptId extends string> = {
  id: PromptId
  repeat?: boolean
}

export type CoachPromptResolution<PromptId extends string> = {
  activePrompt: PromptId | null
  prompts: Record<
    PromptId,
    {
      active: boolean
      dismissed: boolean
      enabled: boolean
      shown: boolean
    }
  >
}

export type CoachRuntime<
  FactId extends string,
  PromptId extends string,
> = {
  init(): CoachRuntimeState<FactId, PromptId>
  rememberFacts(
    current: CoachRuntimeState<FactId, PromptId>,
    next: Partial<Record<FactId, boolean>>,
  ): CoachRuntimeState<FactId, PromptId>
  resolvePrompts(
    current: CoachRuntimeState<FactId, PromptId>,
    eligibility: Partial<Record<PromptId, boolean>>,
  ): CoachPromptResolution<PromptId>
  markPromptShown(
    current: CoachRuntimeState<FactId, PromptId>,
    promptId: PromptId,
  ): CoachRuntimeState<FactId, PromptId>
  dismissPrompt(
    current: CoachRuntimeState<FactId, PromptId>,
    promptId: PromptId,
  ): CoachRuntimeState<FactId, PromptId>
}

function orderedRecord<K extends string, V>(
  keys: readonly K[],
  createValue: (key: K) => V,
): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, createValue(key)])) as Record<K, V>
}

export function createCoachRuntime<
  FactId extends string,
  PromptId extends string,
>(config: {
  facts: readonly FactId[]
  prompts: readonly CoachPromptConfig<PromptId>[]
}): CoachRuntime<FactId, PromptId> {
  const factIds = [...config.facts]
  const promptIds = config.prompts.map((prompt) => prompt.id)
  const promptConfig = Object.fromEntries(
    config.prompts.map((prompt) => [prompt.id, prompt]),
  ) as Record<PromptId, CoachPromptConfig<PromptId>>

  const factSeed = orderedRecord(factIds, () => false)
  const promptSeed = orderedRecord(promptIds, () => ({
    dismissed: false,
    shown: false,
  }))

  function isPromptEnabled(
    state: CoachRuntimeState<FactId, PromptId>,
    eligibility: Partial<Record<PromptId, boolean>>,
    promptId: PromptId,
  ) {
    return Boolean(eligibility[promptId]) && !state.prompts[promptId].dismissed
  }

  function shouldReappear(
    state: CoachRuntimeState<FactId, PromptId>,
    promptId: PromptId,
  ) {
    return Boolean(promptConfig[promptId].repeat) || !state.prompts[promptId].shown
  }

  function findNextPrompt(
    state: CoachRuntimeState<FactId, PromptId>,
    eligibility: Partial<Record<PromptId, boolean>>,
  ): PromptId | null {
    const eligiblePrompts = promptIds.filter((promptId) =>
      isPromptEnabled(state, eligibility, promptId) &&
      shouldReappear(state, promptId),
    )

    return eligiblePrompts.at(-1) ?? null
  }

  return {
    init() {
      return {
        facts: { ...factSeed },
        prompts: { ...promptSeed },
      }
    },

    rememberFacts(current, next) {
      let changed = false
      const facts = { ...current.facts }

      for (const factId of factIds) {
        if (Boolean(next[factId]) && facts[factId] !== true) {
          facts[factId] = true
          changed = true
        }
      }

      return changed
        ? {
            ...current,
            facts,
          }
        : current
    },

    resolvePrompts(current, eligibility) {
      const activePrompt = findNextPrompt(current, eligibility)

      return {
        activePrompt,
        prompts: orderedRecord(promptIds, (promptId) => ({
          active: promptId === activePrompt,
          dismissed: current.prompts[promptId].dismissed,
          enabled: Boolean(eligibility[promptId]),
          shown: current.prompts[promptId].shown,
        })),
      }
    },

    markPromptShown(current, promptId) {
      if (current.prompts[promptId].shown) {
        return current
      }

      return {
        ...current,
        prompts: {
          ...current.prompts,
          [promptId]: {
            ...current.prompts[promptId],
            shown: true,
          },
        },
      }
    },

    dismissPrompt(current, promptId) {
      if (current.prompts[promptId].dismissed) {
        return current
      }

      return {
        ...current,
        prompts: {
          ...current.prompts,
          [promptId]: {
            ...current.prompts[promptId],
            dismissed: true,
          },
        },
      }
    },
  }
}
