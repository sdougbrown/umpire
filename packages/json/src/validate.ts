import type { UmpireJsonSchema, JsonRule, JsonFieldDef } from './schema.js'
import { assertValidCheckRule } from './check-ops.js'
import { compileExpr } from './expr.js'
import { isJsonIsEmptyStrategy } from './strategies.js'

function isJsonPrimitive(value: unknown): boolean {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function validateFieldDef(field: string, definition: JsonFieldDef) {
  if (definition.default !== undefined && !isJsonPrimitive(definition.default)) {
    throw new Error(`[umpire/json] Field "${field}" has a non-serializable default value`)
  }

  if (
    definition.isEmpty !== undefined &&
    !isJsonIsEmptyStrategy(definition.isEmpty)
  ) {
    throw new Error(`[umpire/json] Unknown isEmpty strategy "${String(definition.isEmpty)}"`)
  }
}

function assertField(field: string, fieldNames: Set<string>, context: string) {
  if (!fieldNames.has(field)) {
    throw new Error(`[umpire/json] Rule ${context} references unknown field "${field}"`)
  }
}

function validateRule(
  rule: JsonRule,
  fieldNames: Set<string>,
  conditions: UmpireJsonSchema['conditions'],
) {
  switch (rule.type) {
    case 'requires':
      assertField(rule.field, fieldNames, '"requires"')
      if ('dependency' in rule) {
        assertField(rule.dependency, fieldNames, '"requires"')
        return
      }

      compileExpr(rule.when, { fieldNames, conditions })
      return
    case 'enabledWhen':
      assertField(rule.field, fieldNames, '"enabledWhen"')
      compileExpr(rule.when, { fieldNames, conditions })
      return
    case 'disables':
      for (const target of rule.targets) {
        assertField(target, fieldNames, '"disables"')
      }

      if ('source' in rule) {
        assertField(rule.source, fieldNames, '"disables"')
        return
      }

      compileExpr(rule.when, { fieldNames, conditions })
      return
    case 'oneOf':
      for (const branchFields of Object.values(rule.branches)) {
        for (const field of branchFields) {
          assertField(field, fieldNames, '"oneOf"')
        }
      }
      return
    case 'fairWhen':
      assertField(rule.field, fieldNames, '"fairWhen"')
      compileExpr(rule.when, { fieldNames, conditions })
      return
    case 'anyOf':
      for (const innerRule of rule.rules) {
        validateRule(innerRule, fieldNames, conditions)
      }
      return
    case 'check':
      assertField(rule.field, fieldNames, '"check"')
      assertValidCheckRule(rule)
      return
    default:
      throw new Error(`[umpire/json] Unknown rule type "${String((rule as { type?: unknown }).type)}"`)
  }
}

export function validateSchema(schema: UmpireJsonSchema): void {
  if (schema.version !== 1) {
    throw new Error(`[umpire/json] Unsupported schema version "${String(schema.version)}"`)
  }

  const fieldNames = new Set(Object.keys(schema.fields ?? {}))

  for (const [field, definition] of Object.entries(schema.fields ?? {})) {
    validateFieldDef(field, definition)
  }

  for (const rule of schema.rules ?? []) {
    validateRule(rule, fieldNames, schema.conditions)
  }
}
