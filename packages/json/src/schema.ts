import type { JsonPrimitive } from '@umpire/core'
import type { Expr } from '@umpire/dsl'

export type JsonConditionType = 'boolean' | 'string' | 'number' | 'string[]' | 'number[]'

export interface JsonConditionDef {
  type: JsonConditionType
  description?: string
}

export type JsonIsEmptyStrategy = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'present'

export interface JsonFieldDef {
  required?: boolean
  default?: JsonPrimitive
  isEmpty?: JsonIsEmptyStrategy
}

type JsonCheckExpr = { op: 'check'; field: string; check: JsonValidatorSpec }

export type JsonExpr = Expr | JsonCheckExpr

export type JsonValidatorOp =
  | 'email'
  | 'url'
  | 'matches'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'range'
  | 'integer'

export type JsonValidatorSpec =
  | { op: 'email' | 'url' | 'integer' }
  | { op: 'matches'; pattern: string }
  | { op: 'minLength' | 'maxLength' | 'min' | 'max'; value: number }
  | { op: 'range'; min: number; max: number }

export type JsonCheckRule = {
  type: 'check'
  field: string
  reason?: string
} & JsonValidatorSpec

export type JsonValidatorDef = JsonValidatorSpec & {
  error?: string
}

export type JsonRequiresDependency = string | JsonExpr

export type JsonRule =
  | { type: 'requires'; field: string; dependency: string; reason?: string }
  | { type: 'requires'; field: string; dependencies: JsonRequiresDependency[]; reason?: string }
  | { type: 'requires'; field: string; when: JsonExpr; reason?: string }
  | { type: 'enabledWhen'; field: string; when: JsonExpr; reason?: string }
  | { type: 'disables'; source: string; targets: string[]; reason?: string }
  | { type: 'disables'; when: JsonExpr; targets: string[]; reason?: string }
  | { type: 'oneOf'; group: string; branches: Record<string, string[]> }
  | { type: 'eitherOf'; group: string; branches: Record<string, JsonRule[]> }
  | { type: 'fairWhen'; field: string; when: JsonExpr; reason?: string }
  | { type: 'anyOf'; rules: JsonRule[] }
  | JsonCheckRule

export interface ExcludedRule {
  type: string
  field?: string
  description: string
  key?: string
  signature?: string
}

export interface UmpireJsonSchema {
  version: 1
  conditions?: Record<string, JsonConditionDef>
  fields: Record<string, JsonFieldDef>
  rules: JsonRule[]
  validators?: Record<string, JsonValidatorDef>
  excluded?: ExcludedRule[]
}
