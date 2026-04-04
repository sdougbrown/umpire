import { evaluate, evaluateRuleForField, indexRulesByTarget } from './evaluator.js'
import {
  getFieldBuilderDef,
  getFieldBuilderName,
  getFieldBuilderRules,
  isFieldBuilder,
} from './field.js'
import type { FieldInput, NormalizeFields } from './field.js'
import { buildGraph, detectCycles, exportGraph, topologicalSort } from './graph.js'
import {
  enabledWhen,
  fairWhen,
  getGraphSourceInfo,
  getInternalRuleMetadata,
  getSourceField,
  requires,
  resolveOneOfState,
} from './rules.js'
import { isSatisfied } from './satisfaction.js'
import type {
  AvailabilityMap,
  ChallengeTrace,
  FieldDef,
  FieldValues,
  Foul,
  InputValues,
  Rule,
  RuleEvaluation,
  Umpire,
} from './types.js'

function createEmptyConditions<C extends Record<string, unknown>>(conditions: C | undefined): C {
  return (conditions ?? ({} as C)) as C
}

function normalizeConfig<
  F extends Record<string, FieldInput>,
  C extends Record<string, unknown>,
>(
  rawFields: F,
  explicitRules: Rule<NormalizeFields<F>, C>[],
): {
  fields: NormalizeFields<F>
  rules: Rule<NormalizeFields<F>, C>[]
} {
  const normalizedFields = {} as NormalizeFields<F>
  const attachedRules: Rule<NormalizeFields<F>, C>[] = []

  for (const [fieldKey, rawField] of Object.entries(rawFields) as Array<[keyof F & string, F[keyof F & string]]>) {
    if (!isFieldBuilder(rawField)) {
      normalizedFields[fieldKey] = rawField as unknown as NormalizeFields<F>[keyof F & string]
      continue
    }

    const namedField = getFieldBuilderName(rawField)
    if (namedField && namedField !== fieldKey) {
      throw new Error(
        `[umpire] Named field builder "${namedField}" does not match field key "${fieldKey}"`,
      )
    }

    normalizedFields[fieldKey] = getFieldBuilderDef(rawField) as NormalizeFields<F>[keyof F & string]

    for (const attachedRule of getFieldBuilderRules(rawField)) {
      if (attachedRule.kind === 'enabledWhen') {
        attachedRules.push(
          enabledWhen<NormalizeFields<F>, C>(
            fieldKey,
            attachedRule.predicate as Parameters<typeof enabledWhen<NormalizeFields<F>, C>>[1],
            attachedRule.options as Parameters<typeof enabledWhen<NormalizeFields<F>, C>>[2],
          ),
        )
        continue
      }

      if (attachedRule.kind === 'fairWhen') {
        attachedRules.push(
          fairWhen<NormalizeFields<F>, C>(
            fieldKey,
            attachedRule.predicate as Parameters<typeof fairWhen<NormalizeFields<F>, C>>[1],
            attachedRule.options as Parameters<typeof fairWhen<NormalizeFields<F>, C>>[2],
          ),
        )
        continue
      }

      attachedRules.push(
        requires<NormalizeFields<F>, C>(
          fieldKey,
          attachedRule.dependency as keyof NormalizeFields<F> & string,
          attachedRule.options as Parameters<typeof requires<NormalizeFields<F>, C>>[2],
        ),
      )
    }
  }

  return {
    fields: normalizedFields,
    rules: [...attachedRules, ...explicitRules],
  }
}

function describeRuleForField<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  rule: Rule<F, C>,
  field: keyof F & string,
  fields: F,
  values: FieldValues<F>,
  conditions: C,
  prev: FieldValues<F> | undefined,
  availability: AvailabilityMap<F>,
  baseRuleCache: Map<Rule<F, C>, Map<string, RuleEvaluation>>,
): ChallengeTrace['directReasons'][number] {
  const metadata = getInternalRuleMetadata(rule)
  const evaluation = evaluateRuleForField(
    rule,
    field,
    fields,
    values,
    conditions,
    prev,
    availability,
    baseRuleCache,
  )

  if (metadata?.kind === 'enabledWhen') {
    const source = getSourceField(metadata.predicate)

    return {
      rule: 'enabledWhen',
      passed: evaluation.enabled,
      reason: evaluation.reason,
      predicate: metadata.predicate.toString(),
      source,
      sourceValue: source ? values[source] : undefined,
    }
  }

  if (metadata?.kind === 'disables') {
    const sourceField = getSourceField(metadata.source)
    const sourceSatisfied =
      typeof metadata.source === 'string'
        ? isSatisfied(values[metadata.source], fields[metadata.source])
        : metadata.source(values, conditions)
    const source = sourceField ?? metadata.source.toString()

    return {
      rule: 'disables',
      passed: evaluation.enabled,
      reason: evaluation.reason,
      source,
      sourceValue: sourceField ? values[sourceField] : sourceSatisfied,
      sourceSatisfied,
    }
  }

  if (metadata?.kind === 'fairWhen') {
    return {
      rule: 'fair',
      passed: evaluation.fair !== false,
      reason: evaluation.reason,
      predicate: metadata.predicate.toString(),
      value: values[field],
    }
  }

  if (metadata?.kind === 'requires') {
    const dependencies = metadata.dependencies.map((dependency) => {
      const dependencyField = getSourceField(dependency)

      if (typeof dependency !== 'string') {
        return {
          dependency: dependencyField ?? dependency.toString(),
          dependencyValue: dependencyField ? values[dependencyField] : undefined,
          satisfied: dependency(values, conditions),
        }
      }

      return {
        dependency,
        satisfied: isSatisfied(values[dependency], fields[dependency]),
        dependencyEnabled: availability[dependency].enabled,
        dependencyFair: availability[dependency].fair,
      }
    })

    return {
      rule: 'requires',
      passed: evaluation.enabled,
      reason: evaluation.reason,
      dependency: dependencies[0]?.dependency,
      dependencyValue: dependencies[0]?.dependencyValue,
      satisfied: dependencies[0]?.satisfied,
      dependencyEnabled: dependencies[0]?.dependencyEnabled,
      dependencyFair: dependencies[0]?.dependencyFair,
      dependencies,
    }
  }

  if (metadata?.kind === 'oneOf') {
    const resolution = resolveOneOfState(
      metadata.groupName,
      metadata.branches,
      values,
      prev,
      metadata.options?.activeBranch,
      fields,
      conditions,
    )
    const thisBranch =
      Object.entries(metadata.branches).find(([, branchFields]) => branchFields.includes(field))?.[0] ?? null

    return {
      rule: 'oneOf',
      passed: evaluation.enabled,
      reason: evaluation.reason,
      group: metadata.groupName,
      activeBranch: resolution.activeBranch,
      thisBranch,
    }
  }

  if (metadata?.kind === 'anyOf') {
    const inner: ChallengeTrace['directReasons'] = metadata.rules.map((innerRule) =>
      describeRuleForField(
        innerRule,
        field,
        fields,
        values,
        conditions,
        prev,
        availability,
        baseRuleCache,
      ),
    )

    return {
      rule: 'anyOf',
      passed: metadata.constraint === 'fair' ? evaluation.fair !== false : evaluation.enabled,
      reason: evaluation.reason,
      inner,
    }
  }

  return {
    rule: rule.type,
    passed: evaluation.enabled,
    reason: evaluation.reason,
  }
}

function collectFailedDependenciesForRule<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  rule: Rule<F, C>,
  field: keyof F & string,
  fields: F,
  values: FieldValues<F>,
  conditions: C,
  prev: FieldValues<F> | undefined,
  availability: AvailabilityMap<F>,
  baseRuleCache: Map<Rule<F, C>, Map<string, RuleEvaluation>>,
): Array<keyof F & string> {
  const metadata = getInternalRuleMetadata(rule)

  if (metadata?.kind === 'anyOf') {
    const evaluation = evaluateRuleForField(
      rule,
      field,
      fields,
      values,
      conditions,
      prev,
      availability,
      baseRuleCache,
    )

    if (metadata.constraint === 'fair' ? evaluation.fair !== false : evaluation.enabled) {
      return []
    }

    return metadata.rules.flatMap((innerRule) =>
      collectFailedDependenciesForRule(
        innerRule,
        field,
        fields,
        values,
        conditions,
        prev,
        availability,
        baseRuleCache,
      ),
    )
  }

  if (metadata?.kind !== 'requires') {
    return []
  }

  const evaluation = evaluateRuleForField(
    rule,
    field,
    fields,
    values,
    conditions,
    prev,
    availability,
    baseRuleCache,
  )

  if (evaluation.enabled) {
    return []
  }

  return metadata.dependencies.filter((dependency): dependency is keyof F & string => {
    if (typeof dependency !== 'string') {
      return false
    }

    const dependencySatisfied = isSatisfied(values[dependency], fields[dependency])
    const dependencyAvailability = availability[dependency]

    return !(dependencySatisfied && dependencyAvailability.enabled && dependencyAvailability.fair)
  })
}

function describeCausedBy<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  field: keyof F & string,
  fields: F,
  rulesByTarget: Map<string, Rule<F, C>[]>,
  values: FieldValues<F>,
  conditions: C,
  prev: FieldValues<F> | undefined,
  availability: AvailabilityMap<F>,
  baseRuleCache: Map<Rule<F, C>, Map<string, RuleEvaluation>>,
): ChallengeTrace['transitiveDeps'][number]['causedBy'] {
  return (rulesByTarget.get(field) ?? [])
    .map((rule) =>
      describeRuleForField(
        rule,
        field,
        fields,
        values,
        conditions,
        prev,
        availability,
        baseRuleCache,
      ),
    )
    .filter((entry) => entry.passed === false)
    .map(({ rule, ...details }) => ({
      rule,
      ...details,
    }))
}

function buildTransitiveDeps<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  startField: keyof F & string,
  fields: F,
  rulesByTarget: Map<string, Rule<F, C>[]>,
  values: FieldValues<F>,
  conditions: C,
  prev: FieldValues<F> | undefined,
  availability: AvailabilityMap<F>,
  baseRuleCache: Map<Rule<F, C>, Map<string, RuleEvaluation>>,
) {
  const visited = new Set<string>()
  const result: ChallengeTrace['transitiveDeps'] = []

  const visit = (field: keyof F & string) => {
    for (const rule of rulesByTarget.get(field) ?? []) {
      for (const dependency of collectFailedDependenciesForRule(
        rule,
        field,
        fields,
        values,
        conditions,
        prev,
        availability,
        baseRuleCache,
      )) {
        const dependencySatisfied = isSatisfied(values[dependency], fields[dependency])
        const dependencyAvailability = availability[dependency]

        if (dependencySatisfied && dependencyAvailability.enabled && dependencyAvailability.fair) {
          continue
        }

        if (visited.has(dependency)) {
          continue
        }

        visited.add(dependency)
        result.push({
          field: dependency,
          enabled: dependencyAvailability.enabled,
          fair: dependencyAvailability.fair,
          reason: dependencyAvailability.reason,
          causedBy: describeCausedBy(
            dependency,
            fields,
            rulesByTarget,
            values,
            conditions,
            prev,
            availability,
            baseRuleCache,
          ),
        })

        if (!dependencyAvailability.enabled || !dependencyAvailability.fair) {
          visit(dependency)
        }
      }
    }
  }

  visit(startField)

  return result
}

function validateRules<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(fields: F, rules: Rule<F, C>[]): void {
  const fieldNames = new Set(Object.keys(fields))

  for (const rule of rules) {
    const metadata = getInternalRuleMetadata(rule)
    const { ordering, informational } = getGraphSourceInfo(rule)

    if (metadata?.kind === 'oneOf') {
      for (const [branchName, branchFields] of Object.entries(metadata.branches)) {
        for (const field of branchFields) {
          if (!fieldNames.has(field)) {
            throw new Error(
              `[umpire] Unknown field "${field}" in oneOf("${metadata.groupName}") branch "${branchName}"`,
            )
          }
        }
      }
    }

    for (const field of [...ordering, ...informational, ...rule.targets]) {
      if (!fieldNames.has(field)) {
        throw new Error(`[umpire] Unknown field "${field}" referenced by ${rule.type} rule`)
      }
    }
  }
}

export function umpire<
  FInput extends Record<string, FieldInput>,
  C extends Record<string, unknown> = Record<string, unknown>,
>(config: {
  fields: FInput
  rules: Rule<NormalizeFields<FInput>, C>[]
}): Umpire<NormalizeFields<FInput>, C> {
  const { fields, rules } = normalizeConfig(config.fields, config.rules)
  const fieldNames = Object.keys(fields) as Array<keyof NormalizeFields<FInput> & string>

  validateRules(fields, rules)

  const graph = buildGraph(fields, rules)
  detectCycles(graph)
  const topoOrder = topologicalSort(graph, fieldNames)
  const rulesByTarget = indexRulesByTarget(rules)

  return {
    check(values, conditions, prev) {
      return evaluate(
        fields,
        rules,
        topoOrder,
        values as FieldValues<NormalizeFields<FInput>>,
        createEmptyConditions(conditions),
        prev as FieldValues<NormalizeFields<FInput>> | undefined,
        rulesByTarget,
      )
    },

    play(before, after) {
      const beforeAvailability = evaluate(
        fields,
        rules,
        topoOrder,
        before.values as FieldValues<NormalizeFields<FInput>>,
        createEmptyConditions(before.conditions),
        undefined,
        rulesByTarget,
      )
      const afterAvailability = evaluate(
        fields,
        rules,
        topoOrder,
        after.values as FieldValues<NormalizeFields<FInput>>,
        createEmptyConditions(after.conditions),
        before.values as FieldValues<NormalizeFields<FInput>>,
        rulesByTarget,
      )
      const recommendations: Foul<NormalizeFields<FInput>>[] = []

      for (const field of fieldNames) {
        const disabledTransition =
          beforeAvailability[field].enabled && !afterAvailability[field].enabled
        const foulTransition =
          beforeAvailability[field].fair && afterAvailability[field].fair === false

        if (!disabledTransition && !foulTransition) {
          continue
        }

        const currentValue = after.values[field]
        const suggestedValue = fields[field].default

        if (!isSatisfied(currentValue, fields[field])) {
          continue
        }

        if (Object.is(currentValue, suggestedValue)) {
          continue
        }

        recommendations.push({
          field,
          reason: afterAvailability[field].reason ?? (disabledTransition ? 'field disabled' : 'field fouled'),
          suggestedValue,
        })
      }

      return recommendations
    },

    init(overrides) {
      const values = {} as FieldValues<NormalizeFields<FInput>>

      for (const field of fieldNames) {
        values[field] = fields[field].default as FieldValues<NormalizeFields<FInput>>[typeof field]
      }

      if (!overrides) {
        return values
      }

      for (const field of fieldNames) {
        if (field in overrides) {
          values[field] = overrides[field] as FieldValues<NormalizeFields<FInput>>[typeof field]
        }
      }

      return values
    },

    challenge(field, values, conditions, prev) {
      if (!(field in fields)) {
        throw new Error(`[umpire] Unknown field "${field}"`)
      }

      const resolvedConditions = createEmptyConditions(conditions)
      const typedValues = values as FieldValues<NormalizeFields<FInput>>
      const typedPrev = prev as FieldValues<NormalizeFields<FInput>> | undefined
      const availability = evaluate(
        fields,
        rules,
        topoOrder,
        typedValues,
        resolvedConditions,
        typedPrev,
        rulesByTarget,
      )
      const baseRuleCache = new Map<Rule<NormalizeFields<FInput>, C>, Map<string, RuleEvaluation>>()
      const directReasons = (rulesByTarget.get(field) ?? [])
        .map((rule) =>
          describeRuleForField(
            rule,
            field,
            fields,
            typedValues,
            resolvedConditions,
            typedPrev,
            availability,
            baseRuleCache,
          ),
        )

      const oneOfRule = (rulesByTarget.get(field) ?? []).find((rule) => {
        const metadata = getInternalRuleMetadata(rule)
        return metadata?.kind === 'oneOf'
      })
      const oneOfMetadata = oneOfRule ? getInternalRuleMetadata(oneOfRule) : undefined
      const oneOfResolution =
        oneOfMetadata?.kind === 'oneOf'
          ? {
              group: oneOfMetadata.groupName,
              ...resolveOneOfState(
                oneOfMetadata.groupName,
                oneOfMetadata.branches,
                typedValues,
                typedPrev,
                oneOfMetadata.options?.activeBranch,
                fields,
                resolvedConditions,
              ),
            }
          : null

      return {
        field,
        enabled: availability[field].enabled,
        fair: availability[field].fair,
        directReasons,
        transitiveDeps: buildTransitiveDeps(
          field,
          fields,
          rulesByTarget,
          typedValues,
          resolvedConditions,
          typedPrev,
          availability,
          baseRuleCache,
        ),
        oneOfResolution,
      }
    },

    graph() {
      return exportGraph(graph)
    },
  }
}
