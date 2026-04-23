import type {
  FieldDef,
  FieldStatus,
  ScorecardResult,
  Umpire,
} from '@umpire/core'

export type CheckAssertChain<K extends string> = {
  enabled(...fields: K[]): CheckAssertChain<K>
  disabled(...fields: K[]): CheckAssertChain<K>
  fair(...fields: K[]): CheckAssertChain<K>
  foul(...fields: K[]): CheckAssertChain<K>
  required(...fields: K[]): CheckAssertChain<K>
  optional(...fields: K[]): CheckAssertChain<K>
  satisfied(...fields: K[]): CheckAssertChain<K>
  unsatisfied(...fields: K[]): CheckAssertChain<K>
}

export type ScorecardAssertChain<K extends string> = {
  changed(...fields: K[]): ScorecardAssertChain<K>
  notChanged(...fields: K[]): ScorecardAssertChain<K>
  cascaded(...fields: K[]): ScorecardAssertChain<K>
  fouled(...fields: K[]): ScorecardAssertChain<K>
  notFouled(...fields: K[]): ScorecardAssertChain<K>
  onlyChanged(...fields: K[]): ScorecardAssertChain<K>
  onlyFouled(...fields: K[]): ScorecardAssertChain<K>
  check(): CheckAssertChain<K>
}

function buildFailMessage(
  prefix: string,
  label: string,
  failures: Array<{ field: string; detail: string }>,
): string {
  if (failures.length === 1) {
    return `${prefix}: expected "${failures[0].field}" to be ${label} — ${failures[0].detail}`
  }

  return [
    `${prefix}: expected the following field(s) to be ${label}:`,
    ...failures.map((f) => `  "${f.field}" — ${f.detail}`),
  ].join('\n')
}

function runAssert<K extends string>(
  result: Record<K, FieldStatus>,
  fields: K[],
  predicate: (status: FieldStatus) => boolean,
  label: string,
  detail: (field: K, status: FieldStatus) => string,
): void {
  const failures: Array<{ field: string; detail: string }> = []

  for (const field of fields) {
    const status = result[field]

    if (status === undefined) {
      throw new Error(`checkAssert: unknown field "${field}"`)
    }

    if (!predicate(status)) {
      failures.push({ field, detail: detail(field, status) })
    }
  }

  if (failures.length > 0) {
    throw new Error(buildFailMessage('checkAssert', label, failures))
  }
}

function buildSetFailMessage<K extends string>(
  label: string,
  actualFields: K[],
  expectedFields: K[],
): string {
  const actual = new Set(actualFields)
  const expected = new Set(expectedFields)
  const missing = [...expected].filter((field) => !actual.has(field))
  const unexpected = [...actual].filter((field) => !expected.has(field))
  const details: string[] = []

  if (missing.length > 0) {
    details.push(`missing ${JSON.stringify(missing)}`)
  }

  if (unexpected.length > 0) {
    details.push(`unexpected ${JSON.stringify(unexpected)}`)
  }

  return `scorecardAssert: expected only ${label} to be ${JSON.stringify(expectedFields)} — ${details.join('; ')}`
}

function assertKnownScorecardFields<K extends string>(
  result: ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
  fields: K[],
): void {
  for (const field of fields) {
    if (result.fields[field] === undefined) {
      throw new Error(`scorecardAssert: unknown field "${field}"`)
    }
  }
}

function runScorecardFieldAssert<K extends string>(
  result: ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
  fields: K[],
  predicate: (
    field: ScorecardResult<
      Record<K, FieldDef>,
      Record<string, unknown>
    >['fields'][K],
  ) => boolean,
  label: string,
  detail: (
    field: K,
    scorecardField: ScorecardResult<
      Record<K, FieldDef>,
      Record<string, unknown>
    >['fields'][K],
  ) => string,
): void {
  const failures: Array<{ field: string; detail: string }> = []

  for (const field of fields) {
    const scorecardField = result.fields[field]

    if (scorecardField === undefined) {
      throw new Error(`scorecardAssert: unknown field "${field}"`)
    }

    if (!predicate(scorecardField)) {
      failures.push({ field, detail: detail(field, scorecardField) })
    }
  }

  if (failures.length > 0) {
    throw new Error(buildFailMessage('scorecardAssert', label, failures))
  }
}

function runExactSetAssert<K extends string>(
  result: ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
  actualFields: K[],
  expectedFields: K[],
  label: string,
): void {
  assertKnownScorecardFields(result, expectedFields)

  const actual = new Set(actualFields)
  const expected = new Set(expectedFields)

  if (actual.size !== expected.size) {
    throw new Error(buildSetFailMessage(label, actualFields, expectedFields))
  }

  for (const field of expected) {
    if (!actual.has(field)) {
      throw new Error(buildSetFailMessage(label, actualFields, expectedFields))
    }
  }
}

export function checkAssert<K extends string>(
  result: Record<K, FieldStatus>,
): CheckAssertChain<K> {
  const chain: CheckAssertChain<K> = {
    enabled(...fields) {
      runAssert(
        result,
        fields,
        (s) => s.enabled,
        'enabled',
        (_f, s) =>
          `was disabled${s.reason ? ` (reason: ${JSON.stringify(s.reason)})` : ''}`,
      )
      return chain
    },
    disabled(...fields) {
      runAssert(
        result,
        fields,
        (s) => !s.enabled,
        'disabled',
        () => 'was enabled',
      )
      return chain
    },
    fair(...fields) {
      runAssert(
        result,
        fields,
        (s) => s.fair,
        'fair',
        (_f, s) =>
          `was foul${s.reason ? ` (reason: ${JSON.stringify(s.reason)})` : ''}`,
      )
      return chain
    },
    foul(...fields) {
      runAssert(
        result,
        fields,
        (s) => !s.fair,
        'foul',
        (_f, s) => `was fair (enabled: ${s.enabled})`,
      )
      return chain
    },
    required(...fields) {
      runAssert(
        result,
        fields,
        (s) => s.required,
        'required',
        () => 'was optional',
      )
      return chain
    },
    optional(...fields) {
      runAssert(
        result,
        fields,
        (s) => !s.required,
        'optional',
        () => 'was required',
      )
      return chain
    },
    satisfied(...fields) {
      runAssert(
        result,
        fields,
        (s) => s.satisfied,
        'satisfied',
        () => 'was unsatisfied (no value)',
      )
      return chain
    },
    unsatisfied(...fields) {
      runAssert(
        result,
        fields,
        (s) => !s.satisfied,
        'unsatisfied',
        () => 'was satisfied (has a value)',
      )
      return chain
    },
  }

  return chain
}

export function scorecardAssert<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(result: ScorecardResult<F, C>): ScorecardAssertChain<keyof F & string> {
  type K = keyof F & string

  const chain: ScorecardAssertChain<K> = {
    changed(...fields) {
      runScorecardFieldAssert(
        result as ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
        fields,
        (scorecardField) => scorecardField.changed,
        'changed',
        () => 'did not change',
      )
      return chain
    },
    notChanged(...fields) {
      runScorecardFieldAssert(
        result as ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
        fields,
        (scorecardField) => !scorecardField.changed,
        'unchanged',
        () => 'changed',
      )
      return chain
    },
    cascaded(...fields) {
      runScorecardFieldAssert(
        result as ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
        fields,
        (scorecardField) => scorecardField.cascaded,
        'cascaded',
        () => 'did not cascade',
      )
      return chain
    },
    fouled(...fields) {
      runScorecardFieldAssert(
        result as ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
        fields,
        (scorecardField) => scorecardField.foul !== null,
        'fouled',
        () => 'had no foul recommendation',
      )
      return chain
    },
    notFouled(...fields) {
      runScorecardFieldAssert(
        result as ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
        fields,
        (scorecardField) => scorecardField.foul === null,
        'not fouled',
        (_field, scorecardField) =>
          `had foul recommendation${scorecardField.foul?.reason ? ` (reason: ${JSON.stringify(scorecardField.foul.reason)})` : ''}`,
      )
      return chain
    },
    onlyChanged(...fields) {
      runExactSetAssert(
        result as ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
        result.transition.changedFields as K[],
        fields,
        'changed fields',
      )
      return chain
    },
    onlyFouled(...fields) {
      runExactSetAssert(
        result as ScorecardResult<Record<K, FieldDef>, Record<string, unknown>>,
        result.transition.fouledFields as K[],
        fields,
        'fouled fields',
      )
      return chain
    },
    check() {
      return checkAssert(result.check)
    },
  }

  return chain
}

const VALUE_PROBES = [null, undefined, '', 'a', 0, 1, true, false] as const
const MAX_VIOLATIONS = 50
const DEFAULT_SAMPLE_COUNT = 1000
const DEFAULT_SEED = 42
const DEFAULT_MAX_FOUL_ITERATIONS = 10

export type AnyUmpire = Umpire<
  Record<string, FieldDef>,
  Record<string, unknown>
>

export type MonkeyTestViolation = {
  invariant:
    | 'determinism'
    | 'self-play'
    | 'foul-convergence'
    | 'challenge-check-agreement'
    | 'disabled-field-immunity'
    | 'init-clean'
  values: Record<string, unknown>
  conditions?: Record<string, unknown>
  description: string
}

export type MonkeyTestResult = {
  passed: boolean
  violations: MonkeyTestViolation[]
  samplesChecked: number
}

export type MonkeyTestOptions = {
  samples?: number
  seed?: number
  conditions?: Record<string, unknown>[]
  maxFoulIterations?: number
}

function mulberry32(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let result = Math.imul(state ^ (state >>> 15), 1 | state)
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function cloneRecord(record: Record<string, unknown>) {
  return { ...record }
}

function toViolation(
  invariant: MonkeyTestViolation['invariant'],
  values: Record<string, unknown>,
  description: string,
  conditions?: Record<string, unknown>,
): MonkeyTestViolation {
  return conditions === undefined
    ? {
        invariant,
        values: cloneRecord(values),
        description,
      }
    : {
        invariant,
        values: cloneRecord(values),
        conditions: cloneRecord(conditions),
        description,
      }
}

function describeValue(value: unknown) {
  if (value === undefined) {
    return 'undefined'
  }

  return JSON.stringify(value)
}

function buildUpstreamByField(
  fieldNames: string[],
  edges: Array<{ from: string; to: string }>,
) {
  const upstreamByField = new Map<string, Set<string>>(
    fieldNames.map((field) => [field, new Set<string>()]),
  )

  for (const edge of edges) {
    const upstream = upstreamByField.get(edge.to)

    if (upstream) {
      upstream.add(edge.from)
      continue
    }

    upstreamByField.set(edge.to, new Set([edge.from]))
  }

  return upstreamByField
}

function applyFouls(
  values: Record<string, unknown>,
  fouls: Array<{ field: string; suggestedValue: unknown }>,
) {
  const nextValues = cloneRecord(values)

  for (const foul of fouls) {
    nextValues[foul.field] = foul.suggestedValue
  }

  return nextValues
}

function forEachSampleValueSet(
  fieldNames: string[],
  options: MonkeyTestOptions | undefined,
  visit: (values: Record<string, unknown>) => boolean,
) {
  if (fieldNames.length <= 6) {
    const totalCombinations = VALUE_PROBES.length ** fieldNames.length

    for (
      let sampleIndex = 0;
      sampleIndex < totalCombinations;
      sampleIndex += 1
    ) {
      let cursor = sampleIndex
      const values: Record<string, unknown> = {}

      for (const field of fieldNames) {
        values[field] = VALUE_PROBES[cursor % VALUE_PROBES.length]
        cursor = Math.floor(cursor / VALUE_PROBES.length)
      }

      if (visit(values)) {
        return
      }
    }

    return
  }

  const sampleCount = Math.max(
    0,
    Math.floor(options?.samples ?? DEFAULT_SAMPLE_COUNT),
  )
  const random = mulberry32(options?.seed ?? DEFAULT_SEED)

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const values: Record<string, unknown> = {}

    for (const field of fieldNames) {
      const probeIndex = Math.floor(random() * VALUE_PROBES.length)
      values[field] = VALUE_PROBES[probeIndex]
    }

    if (visit(values)) {
      return
    }
  }
}

function getConditionSets(options: MonkeyTestOptions | undefined) {
  return options?.conditions && options.conditions.length > 0
    ? options.conditions
    : [undefined]
}

export function monkeyTest<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(ump: Umpire<F, C>, options?: MonkeyTestOptions): MonkeyTestResult
export function monkeyTest(
  ump: AnyUmpire,
  options: MonkeyTestOptions = {},
): MonkeyTestResult {
  const graph = ump.graph()
  const fieldNames = [...graph.nodes]
  const upstreamByField = buildUpstreamByField(fieldNames, graph.edges)
  const maxFoulIterations = Math.max(
    1,
    Math.floor(options.maxFoulIterations ?? DEFAULT_MAX_FOUL_ITERATIONS),
  )
  const conditionsList = getConditionSets(options)
  const violations: MonkeyTestViolation[] = []
  let samplesChecked = 0

  const recordViolation = (
    invariant: MonkeyTestViolation['invariant'],
    values: Record<string, unknown>,
    description: string,
    conditions?: Record<string, unknown>,
  ) => {
    if (violations.length >= MAX_VIOLATIONS) {
      return true
    }

    violations.push(toViolation(invariant, values, description, conditions))
    return violations.length >= MAX_VIOLATIONS
  }

  const initValues = ump.init()
  const initFouls = ump.play({ values: initValues }, { values: initValues })
  if (initFouls.length > 0) {
    recordViolation(
      'init-clean',
      initValues,
      `play(init(), init()) returned ${initFouls.length} foul recommendation(s)`,
    )
  }

  if (violations.length >= MAX_VIOLATIONS) {
    return {
      passed: false,
      violations,
      samplesChecked,
    }
  }

  forEachSampleValueSet(fieldNames, options, (values) => {
    for (const conditions of conditionsList) {
      samplesChecked += 1

      const firstCheck = ump.check(values, conditions)
      const secondCheck = ump.check(values, conditions)

      for (const field of fieldNames) {
        if (
          firstCheck[field].enabled !== secondCheck[field].enabled ||
          firstCheck[field].fair !== secondCheck[field].fair
        ) {
          if (
            recordViolation(
              'determinism',
              values,
              `check() disagreed for "${field}": first={enabled:${firstCheck[field].enabled}, fair:${firstCheck[field].fair}} second={enabled:${secondCheck[field].enabled}, fair:${secondCheck[field].fair}}`,
              conditions,
            )
          ) {
            return true
          }
        }
      }

      const selfPlayFouls = ump.play(
        { values, conditions },
        { values, conditions },
      )

      if (
        selfPlayFouls.length > 0 &&
        recordViolation(
          'self-play',
          values,
          `play(snapshot, snapshot) returned ${selfPlayFouls.length} foul recommendation(s)`,
          conditions,
        )
      ) {
        return true
      }

      let currentValues = cloneRecord(values)
      let converged = false

      for (let iteration = 0; iteration < maxFoulIterations; iteration += 1) {
        const fouls = ump.play(
          { values: initValues, conditions },
          { values: currentValues, conditions },
        )

        if (fouls.length === 0) {
          converged = true
          break
        }

        currentValues = applyFouls(currentValues, fouls)
      }

      if (
        !converged &&
        recordViolation(
          'foul-convergence',
          values,
          `Foul suggestions did not converge within ${maxFoulIterations} iteration(s)`,
          conditions,
        )
      ) {
        return true
      }

      for (const field of fieldNames) {
        const trace = ump.challenge(field, values, conditions)
        if (
          trace.enabled !== firstCheck[field].enabled ||
          trace.fair !== firstCheck[field].fair
        ) {
          if (
            recordViolation(
              'challenge-check-agreement',
              values,
              `challenge("${field}") disagreed with check(): challenge={enabled:${trace.enabled}, fair:${trace.fair}} check={enabled:${firstCheck[field].enabled}, fair:${firstCheck[field].fair}}`,
              conditions,
            )
          ) {
            return true
          }
        }
      }

      for (const disabledField of fieldNames) {
        if (firstCheck[disabledField].enabled) {
          continue
        }

        for (const probeValue of VALUE_PROBES) {
          const mutatedValues = {
            ...values,
            [disabledField]: probeValue,
          }
          const mutatedCheck = ump.check(mutatedValues, conditions)

          for (const field of fieldNames) {
            if (upstreamByField.get(field)?.has(disabledField)) {
              continue
            }

            if (mutatedCheck[field].enabled !== firstCheck[field].enabled) {
              if (
                recordViolation(
                  'disabled-field-immunity',
                  values,
                  `Changing disabled field "${disabledField}" to ${describeValue(probeValue)} changed "${field}" enabled from ${firstCheck[field].enabled} to ${mutatedCheck[field].enabled}`,
                  conditions,
                )
              ) {
                return true
              }
            }
          }
        }
      }

      if (violations.length >= MAX_VIOLATIONS) {
        return true
      }
    }

    return violations.length >= MAX_VIOLATIONS
  })

  return {
    passed: violations.length === 0,
    violations,
    samplesChecked,
  }
}
