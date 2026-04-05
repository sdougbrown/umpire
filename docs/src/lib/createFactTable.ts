type FactContext<Input, Facts extends Record<string, unknown>> = {
  input: Input
  select<K extends keyof Facts>(key: K): Facts[K]
}

type FactResolvers<Input, Facts extends Record<string, unknown>> = {
  [K in keyof Facts]: (context: FactContext<Input, Facts>) => Facts[K]
}

export type FactTable<Input, Facts extends Record<string, unknown>> = {
  resolve(input: Input): Facts
} & {
  [K in keyof Facts]: (input: Input) => Facts[K]
}

export function createFactTable<
  Input,
  Facts extends Record<string, unknown>,
>(
  resolvers: FactResolvers<Input, Facts>,
): FactTable<Input, Facts> {
  const keys = Object.keys(resolvers) as Array<keyof Facts>

  function createSession(input: Input) {
    const cache = new Map<keyof Facts, Facts[keyof Facts]>()
    const stack: Array<keyof Facts> = []

    function select<K extends keyof Facts>(key: K): Facts[K] {
      if (cache.has(key)) {
        return cache.get(key) as Facts[K]
      }

      if (stack.includes(key)) {
        const cycle = [...stack, key].map(String).join(' -> ')
        throw new Error(`createFactTable circular dependency: ${cycle}`)
      }

      stack.push(key)
      const value = resolvers[key]({ input, select })
      cache.set(key, value)
      stack.pop()
      return value
    }

    return { select }
  }

  const table = {
    resolve(input: Input) {
      const session = createSession(input)

      return Object.fromEntries(
        keys.map((key) => [key, session.select(key)]),
      ) as Facts
    },
  } as FactTable<Input, Facts>

  for (const key of keys) {
    table[key] = ((input: Input) => createSession(input).select(key)) as FactTable<Input, Facts>[typeof key]
  }

  return table
}
