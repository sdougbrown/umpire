import type {
  AvailabilityMap,
  FieldAvailability,
  FieldDef,
  FieldValues,
  ResetRecommendation,
  Umpire,
} from '@umpire/core'

type StoreApi<S> = {
  getState(): S
  subscribe(listener: (state: S, prevState: S) => void): () => void
}

type FromStoreOptions<S, F extends Record<string, FieldDef>, C extends Record<string, unknown>> = {
  select: (state: S) => FieldValues<F>
  context?: (state: S) => C
}

export interface UmpireStore<F extends Record<string, FieldDef>> {
  field(name: keyof F & string): FieldAvailability
  get penalties(): ResetRecommendation<F>[]
  getAvailability(): AvailabilityMap<F>
  subscribe(listener: (availability: AvailabilityMap<F>) => void): () => void
  destroy(): void
}

export function fromStore<
  S,
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown> = Record<string, unknown>,
>(
  ump: Umpire<F, C>,
  store: StoreApi<S>,
  options: FromStoreOptions<S, F, C>,
): UmpireStore<F> {
  const { select, context } = options

  const initialState = store.getState()
  const initialValues = select(initialState)
  const initialCtx = context ? context(initialState) : (undefined as unknown as C)

  let currentAvailability = ump.check(initialValues, initialCtx)
  let currentPenalties: ResetRecommendation<F>[] = []
  let prevValues = initialValues
  let prevCtx = initialCtx

  const listeners = new Set<(availability: AvailabilityMap<F>) => void>()

  const unsubscribe = store.subscribe((state, prevState) => {
    const nextValues = select(state)
    const nextCtx = context ? context(state) : (undefined as unknown as C)
    const prev = select(prevState)
    const prevContext = context ? context(prevState) : (undefined as unknown as C)

    currentAvailability = ump.check(nextValues, nextCtx, prev)
    currentPenalties = ump.flag(
      { values: prev, context: prevContext },
      { values: nextValues, context: nextCtx },
    )

    prevValues = nextValues
    prevCtx = nextCtx

    for (const listener of listeners) {
      listener(currentAvailability)
    }
  })

  return {
    field(name: keyof F & string): FieldAvailability {
      return currentAvailability[name]
    },

    get penalties(): ResetRecommendation<F>[] {
      return currentPenalties
    },

    getAvailability(): AvailabilityMap<F> {
      return currentAvailability
    },

    subscribe(listener: (availability: AvailabilityMap<F>) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    destroy(): void {
      unsubscribe()
      listeners.clear()
    },
  }
}
