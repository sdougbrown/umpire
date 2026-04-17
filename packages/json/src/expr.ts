import {
  compileExpr as compileDslExpr,
  getExprFieldRefs as getDslExprFieldRefs,
  type Expr,
} from '@umpire/dsl'
import { getNamedCheckMetadata, type FieldDef, type FieldValues, type NamedCheckMetadata } from '@umpire/core'

import { assertValidValidatorSpec, createNamedValidatorFromSpec } from './check-ops.js'
import type { JsonConditionDef, JsonExpr } from './schema.js'

type ExprPredicate<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
> = ((values: FieldValues<F>, conditions: C) => boolean) & {
  _checkField?: keyof F & string
  _namedCheck?: NamedCheckMetadata
}

type CompileExprOptions = {
  allowUndeclaredConditions?: boolean
  fieldNames: Set<string>
  conditions?: Record<string, JsonConditionDef>
}

function assertField(field: string, op: string, fieldNames: Set<string>) {
  if (!fieldNames.has(field)) {
    throw new Error(`[@umpire/json] Unknown field "${field}" in "${op}" expression`)
  }
}

export function getExprFieldRefs(expression: JsonExpr): string[] {
  if (expression.op === 'check') {
    return [expression.field]
  }

  if (!containsCheck(expression)) {
    return getDslExprFieldRefs(expression)
  }

  if (expression.op === 'and' || expression.op === 'or') {
    return [...new Set(expression.exprs.flatMap((entry) => getExprFieldRefs(entry)))]
  }

  if (expression.op === 'not') {
    return getExprFieldRefs(expression.expr)
  }

  return getDslExprFieldRefs(expression)
}

function containsCheck(expression: JsonExpr): boolean {
  if (expression.op === 'check') {
    return true
  }

  if (expression.op === 'and' || expression.op === 'or') {
    return expression.exprs.some((entry) => containsCheck(entry))
  }

  if (expression.op === 'not') {
    return containsCheck(expression.expr)
  }

  return false
}

function compileCheckExpr<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  expression: Extract<JsonExpr, { op: 'check' }>,
  options: CompileExprOptions,
): ExprPredicate<F, C> {
  assertField(expression.field, expression.op, options.fieldNames)
  assertValidValidatorSpec(expression.check)

  const validator = createNamedValidatorFromSpec(expression.check)

  const predicate = ((values) => {
    const value = values[expression.field as keyof F & string]

    return value != null && validator.validate(value as never)
  }) as ExprPredicate<F, C>

  predicate._checkField = expression.field as keyof F & string
  predicate._namedCheck = getNamedCheckMetadata(validator)

  return predicate
}

export function compileExpr<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
>(
  expression: JsonExpr,
  options: CompileExprOptions,
): ExprPredicate<F, C> {
  let predicate: ExprPredicate<F, C>

  if (expression.op === 'check') {
    predicate = compileCheckExpr<F, C>(expression, options)
  } else if (!containsCheck(expression)) {
    predicate = compileDslExpr<F, C>(expression as Expr, options)
  } else if (expression.op === 'and') {
    if (!Array.isArray(expression.exprs)) {
      throw new Error('[@umpire/json] "and" expression requires an exprs array')
    }

    const predicates = expression.exprs.map((entry) => compileExpr<F, C>(entry, options))
    predicate = (((values: FieldValues<F>, conditions: C) =>
      predicates.every((entry) => entry(values, conditions))) as ExprPredicate<F, C>)
  } else if (expression.op === 'or') {
    if (!Array.isArray(expression.exprs)) {
      throw new Error('[@umpire/json] "or" expression requires an exprs array')
    }

    const predicates = expression.exprs.map((entry) => compileExpr<F, C>(entry, options))
    predicate = (((values: FieldValues<F>, conditions: C) =>
      predicates.some((entry) => entry(values, conditions))) as ExprPredicate<F, C>)
  } else if (expression.op === 'not') {
    const inner = compileExpr<F, C>(expression.expr, options)
    predicate = (((values: FieldValues<F>, conditions: C) => !inner(values, conditions)) as ExprPredicate<F, C>)
  } else {
    predicate = compileDslExpr<F, C>(expression as Expr, options)
  }

  const fieldRefs = getExprFieldRefs(expression)

  if (fieldRefs.length === 1) {
    predicate._checkField = fieldRefs[0] as keyof F & string
  }

  return predicate
}
