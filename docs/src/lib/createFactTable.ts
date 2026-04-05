type FactContext<
  Input extends Record<string, unknown>,
  Facts extends Record<string, unknown>,
> = {
  input: Input
  select<K extends keyof Facts>(key: K): Facts[K]
}

type FactResolvers<
  Input extends Record<string, unknown>,
  Facts extends Record<string, unknown>,
> = {
  [K in keyof Facts]: (context: FactContext<Input, Facts>) => Facts[K]
}

export type FactTableNode<
  Input extends Record<string, unknown>,
  Facts extends Record<string, unknown>,
  FactId extends keyof Facts & string,
> = {
  dependsOnFacts: Array<keyof Facts & string>
  dependsOnFields: Array<keyof Input & string>
  id: FactId
  value: Facts[FactId]
}

export type FactTableInspection<
  Input extends Record<string, unknown>,
  Facts extends Record<string, unknown>,
> = {
  graph: {
    edges: Array<
      | {
          from: keyof Facts & string
          to: keyof Facts & string
          type: 'fact'
        }
      | {
          from: keyof Input & string
          to: keyof Facts & string
          type: 'field'
        }
    >
    nodes: Array<keyof Facts & string>
  }
  nodes: {
    [K in keyof Facts & string]: FactTableNode<Input, Facts, K>
  }
  values: Facts
}

export type FactTable<
  Input extends Record<string, unknown>,
  Facts extends Record<string, unknown>,
> = {
  resolve(input: Input): Facts
  inspect(input: Input): FactTableInspection<Input, Facts>
} & {
  [K in keyof Facts]: (input: Input) => Facts[K]
}

export function createFactTable<
  Input extends Record<string, unknown>,
  Facts extends Record<string, unknown>,
>(
  resolvers: FactResolvers<Input, Facts>,
): FactTable<Input, Facts> {
  const keys = Object.keys(resolvers) as Array<keyof Facts>

  function createSession(input: Input) {
    const cache = new Map<keyof Facts, Facts[keyof Facts]>()
    const stack: Array<keyof Facts> = []
    const factDependencies = new Map<keyof Facts, Set<keyof Facts>>(
      keys.map((key) => [key, new Set<keyof Facts>()]),
    )
    const fieldDependencies = new Map<keyof Facts, Set<keyof Input & string>>(
      keys.map((key) => [key, new Set<keyof Input & string>()]),
    )

    const trackedInput = new Proxy(input, {
      get(target, property, receiver) {
        const current = stack.at(-1)

        if (current && typeof property === 'string') {
          fieldDependencies.get(current)?.add(property as keyof Input & string)
        }

        return Reflect.get(target, property, receiver)
      },
    })

    function select<K extends keyof Facts>(key: K): Facts[K] {
      const current = stack.at(-1)

      if (current && current !== key) {
        factDependencies.get(current)?.add(key)
      }

      if (cache.has(key)) {
        return cache.get(key) as Facts[K]
      }

      if (stack.includes(key)) {
        const cycle = [...stack, key].map(String).join(' -> ')
        throw new Error(`createFactTable circular dependency: ${cycle}`)
      }

      stack.push(key)
      const value = resolvers[key]({ input: trackedInput, select })
      cache.set(key, value)
      stack.pop()
      return value
    }

    return {
      getFactDependencies(key: keyof Facts) {
        return [...(factDependencies.get(key) ?? [])]
      },
      getFieldDependencies(key: keyof Facts) {
        return [...(fieldDependencies.get(key) ?? [])]
      },
      select,
    }
  }

  const table = {
    resolve(input: Input) {
      const session = createSession(input)

      return Object.fromEntries(
        keys.map((key) => [key, session.select(key)]),
      ) as Facts
    },

    inspect(input: Input) {
      const session = createSession(input)
      const values = Object.fromEntries(
        keys.map((key) => [key, session.select(key)]),
      ) as Facts

      const nodes = Object.fromEntries(
        keys.map((key) => [
          key,
          {
            id: key,
            value: values[key],
            dependsOnFacts: session.getFactDependencies(key),
            dependsOnFields: session.getFieldDependencies(key),
          },
        ]),
      ) as FactTableInspection<Input, Facts>['nodes']

      return {
        values,
        nodes,
        graph: {
          nodes: [...keys],
          edges: keys.flatMap((key) => ([
            ...session.getFactDependencies(key).map((from) => ({
              from,
              to: key,
              type: 'fact' as const,
            })),
            ...session.getFieldDependencies(key).map((from) => ({
              from,
              to: key,
              type: 'field' as const,
            })),
          ])),
        },
      }
    },
  } as FactTable<Input, Facts>

  for (const key of keys) {
    table[key] = ((input: Input) => createSession(input).select(key)) as FactTable<Input, Facts>[typeof key]
  }

  return table
}
