import type { RuleTraceAttachment } from '@umpire/core'

type ReadContext<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
> = {
  input: Input
  read<K extends keyof Reads & string>(key: K): Reads[K]
}

type ReadResolvers<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
> = {
  [K in keyof Reads]: (context: ReadContext<Input, Reads>) => Reads[K]
}

export type PredicateReadKey<Reads extends Record<string, unknown>> = {
  [K in keyof Reads]-?: Reads[K] extends boolean ? K : never
}[keyof Reads] & string

export type ReadTableNode<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
  ReadId extends keyof Reads & string,
> = {
  dependsOnReads: Array<keyof Reads & string>
  dependsOnFields: Array<keyof Input & string>
  id: ReadId
  value: Reads[ReadId]
}

export type ReadTableInspection<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
> = {
  graph: {
    edges: Array<
      | {
          from: keyof Reads & string
          to: keyof Reads & string
          type: 'read'
        }
      | {
          from: keyof Input & string
          to: keyof Reads & string
          type: 'field'
        }
    >
    nodes: Array<keyof Reads & string>
  }
  nodes: {
    [K in keyof Reads & string]: ReadTableNode<Input, Reads, K>
  }
  values: Reads
}

export type ReadTable<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
> = {
  from<K extends PredicateReadKey<Reads>>(
    key: K,
  ): (
    value: unknown,
    values: Input,
    conditions?: unknown,
  ) => Reads[K]
  from<K extends PredicateReadKey<Reads>, Args extends unknown[]>(
    key: K,
    selectInput: (...args: Args) => Input,
  ): (...args: Args) => Reads[K]
  inspect(input: Input): ReadTableInspection<Input, Reads>
  resolve(input: Input): Reads
  trace<K extends keyof Reads & string, C extends Record<string, unknown> = Record<string, unknown>>(
    key: K,
  ): RuleTraceAttachment<Input, C>
} & {
  [K in keyof Reads]: (input: Input) => Reads[K]
}

export function fromRead<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
  K extends PredicateReadKey<Reads>,
>(
  table: ReadTable<Input, Reads>,
  key: K,
): (
  value: unknown,
  values: Input,
  conditions?: unknown,
) => Reads[K]
export function fromRead<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
  K extends PredicateReadKey<Reads>,
  Args extends unknown[],
>(
  table: ReadTable<Input, Reads>,
  key: K,
  selectInput: (...args: Args) => Input,
): (...args: Args) => Reads[K]
export function fromRead<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
  K extends PredicateReadKey<Reads>,
>(
  table: ReadTable<Input, Reads>,
  key: K,
  selectInput?: (...args: unknown[]) => Input,
) {
  if (selectInput) {
    return (...args: unknown[]) => table[key](selectInput(...args)) as Reads[K]
  }

  return (
    _value: unknown,
    values: Input,
    _conditions?: unknown,
  ) => table[key](values) as Reads[K]
}

export function createReadTable<
  Input extends Record<string, unknown>,
  Reads extends Record<string, unknown>,
>(
  resolvers: ReadResolvers<Input, Reads>,
): ReadTable<Input, Reads> {
  const keys = Object.keys(resolvers) as Array<keyof Reads & string>

  function createSession(input: Input) {
    const cache = new Map<keyof Reads & string, Reads[keyof Reads & string]>()
    const stack: Array<keyof Reads & string> = []
    const readDependencies = new Map<keyof Reads & string, Set<keyof Reads & string>>(
      keys.map((key) => [key, new Set<keyof Reads & string>()]),
    )
    const fieldDependencies = new Map<keyof Reads & string, Set<keyof Input & string>>(
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

    function read<K extends keyof Reads & string>(key: K): Reads[K] {
      const current = stack.at(-1)

      if (current && current !== key) {
        readDependencies.get(current)?.add(key)
      }

      if (cache.has(key)) {
        return cache.get(key) as Reads[K]
      }

      if (stack.includes(key)) {
        const cycle = [...stack, key].map(String).join(' -> ')
        throw new Error(`createReadTable circular dependency: ${cycle}`)
      }

      stack.push(key)
      const value = resolvers[key]({ input: trackedInput, read })
      cache.set(key, value)
      stack.pop()
      return value
    }

    return {
      getReadDependencies(key: keyof Reads & string) {
        return [...(readDependencies.get(key) ?? [])]
      },
      getFieldDependencies(key: keyof Reads & string) {
        return [...(fieldDependencies.get(key) ?? [])]
      },
      read,
    }
  }

  function inspectInput(input: Input): ReadTableInspection<Input, Reads> {
    const session = createSession(input)
    const values = Object.fromEntries(
      keys.map((key) => [key, session.read(key)]),
    ) as Reads

    const nodes = Object.fromEntries(
      keys.map((key) => [
        key,
        {
          id: key,
          value: values[key],
          dependsOnReads: session.getReadDependencies(key),
          dependsOnFields: session.getFieldDependencies(key),
        },
      ]),
    ) as ReadTableInspection<Input, Reads>['nodes']

    return {
      values,
      nodes,
      graph: {
        nodes: [...keys],
        edges: keys.flatMap((key) => ([
          ...session.getReadDependencies(key).map((from) => ({
            from,
            to: key,
            type: 'read' as const,
          })),
          ...session.getFieldDependencies(key).map((from) => ({
            from,
            to: key,
            type: 'field' as const,
          })),
        ])),
      },
    }
  }

  function resolveInput(input: Input): Reads {
    return inspectInput(input).values
  }

  function resolveRead<K extends keyof Reads>(key: K, input: Input): Reads[K] {
    return resolveInput(input)[key]
  }

  function buildPredicate<K extends PredicateReadKey<Reads>>(
    key: K,
    selectInput?: (...args: unknown[]) => Input,
  ) {
    if (selectInput) {
      return (...args: unknown[]) => resolveRead(key, selectInput(...args))
    }

    return (
      _value: unknown,
      values: Input,
      _conditions?: unknown,
    ) => resolveRead(key, values)
  }

  function buildTrace<
    K extends keyof Reads & string,
    C extends Record<string, unknown> = Record<string, unknown>,
  >(key: K): RuleTraceAttachment<Input, C> {
    return {
      kind: 'read',
      id: key,
      inspect(values: Input) {
        const inspected = inspectInput(values)
        const node = inspected.nodes[key]

        return {
          value: node.value,
          dependencies: [
            ...node.dependsOnFields.map((id) => ({ kind: 'field', id })),
            ...node.dependsOnReads.map((id) => ({ kind: 'read', id })),
          ],
        }
      },
    }
  }

  const table = {
    from: buildPredicate,
    inspect: inspectInput,
    resolve: resolveInput,
    trace: buildTrace,
  } as ReadTable<Input, Reads>

  for (const key of keys) {
    table[key] = ((input: Input) => resolveRead(key, input)) as ReadTable<Input, Reads>[typeof key]
  }

  return table
}
