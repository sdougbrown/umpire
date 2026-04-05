export type HintFacts<K extends string> = Record<K, boolean>

export type HintState<K extends string> = Record<
  K,
  {
    dismissed: boolean
    shown: boolean
  }
>

export type HintRuntimeState<
  FactId extends string,
  HintId extends string,
> = {
  facts: HintFacts<FactId>
  hints: HintState<HintId>
}

export type HintConfig<HintId extends string> = {
  id: HintId
  repeat?: boolean
}

export type HintResolution<HintId extends string> = {
  activeHint: HintId | null
  hints: Record<
    HintId,
    {
      active: boolean
      dismissed: boolean
      enabled: boolean
      shown: boolean
    }
  >
}

export type HintRuntime<
  FactId extends string,
  HintId extends string,
> = {
  dismissHint(
    current: HintRuntimeState<FactId, HintId>,
    hintId: HintId,
  ): HintRuntimeState<FactId, HintId>
  init(): HintRuntimeState<FactId, HintId>
  markHintShown(
    current: HintRuntimeState<FactId, HintId>,
    hintId: HintId,
  ): HintRuntimeState<FactId, HintId>
  rememberFacts(
    current: HintRuntimeState<FactId, HintId>,
    next: Partial<Record<FactId, boolean>>,
  ): HintRuntimeState<FactId, HintId>
  resolveHints(
    current: HintRuntimeState<FactId, HintId>,
    eligibility: Partial<Record<HintId, boolean>>,
  ): HintResolution<HintId>
}

function orderedRecord<K extends string, V>(
  keys: readonly K[],
  createValue: (key: K) => V,
): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, createValue(key)])) as Record<K, V>
}

export function createHintRuntime<
  FactId extends string,
  HintId extends string,
>(config: {
  facts: readonly FactId[]
  hints: readonly HintConfig<HintId>[]
}): HintRuntime<FactId, HintId> {
  const factIds = [...config.facts]
  const hintIds = config.hints.map((hint) => hint.id)
  const hintConfig = Object.fromEntries(
    config.hints.map((hint) => [hint.id, hint]),
  ) as Record<HintId, HintConfig<HintId>>

  const factSeed = orderedRecord(factIds, () => false)
  const hintSeed = orderedRecord(hintIds, () => ({
    dismissed: false,
    shown: false,
  }))

  function isHintEnabled(
    state: HintRuntimeState<FactId, HintId>,
    eligibility: Partial<Record<HintId, boolean>>,
    hintId: HintId,
  ) {
    return Boolean(eligibility[hintId]) && !state.hints[hintId].dismissed
  }

  function shouldReappear(
    state: HintRuntimeState<FactId, HintId>,
    hintId: HintId,
  ) {
    return Boolean(hintConfig[hintId].repeat) || !state.hints[hintId].shown
  }

  function findNextHint(
    state: HintRuntimeState<FactId, HintId>,
    eligibility: Partial<Record<HintId, boolean>>,
  ): HintId | null {
    const eligibleHints = hintIds.filter((hintId) =>
      isHintEnabled(state, eligibility, hintId) &&
      shouldReappear(state, hintId),
    )

    return eligibleHints.at(-1) ?? null
  }

  return {
    init() {
      return {
        facts: { ...factSeed },
        hints: { ...hintSeed },
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

    resolveHints(current, eligibility) {
      const activeHint = findNextHint(current, eligibility)

      return {
        activeHint,
        hints: orderedRecord(hintIds, (hintId) => ({
          active: hintId === activeHint,
          dismissed: current.hints[hintId].dismissed,
          enabled: Boolean(eligibility[hintId]),
          shown: current.hints[hintId].shown,
        })),
      }
    },

    markHintShown(current, hintId) {
      if (current.hints[hintId].shown) {
        return current
      }

      return {
        ...current,
        hints: {
          ...current.hints,
          [hintId]: {
            ...current.hints[hintId],
            shown: true,
          },
        },
      }
    },

    dismissHint(current, hintId) {
      if (current.hints[hintId].dismissed) {
        return current
      }

      return {
        ...current,
        hints: {
          ...current.hints,
          [hintId]: {
            ...current.hints[hintId],
            dismissed: true,
          },
        },
      }
    },
  }
}
