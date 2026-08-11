import type { UmpireJsonSchema } from '@umpire/json'
import type { FieldStatus, InputValues } from '@umpire/core'

/**
 * Profile definition issue — signals a problem with the profile document itself.
 */
export type ProfileDefinitionIssue = {
  code: string
  path: string // RFC 6901 pointer into the profile document
  message: string
}

/**
 * Structural issue — signals a problem with an instance value against the value schema.
 */
export type StructuralIssue = {
  source: 'json-schema'
  code: string
  path: string // RFC 6901 pointer into the instance
  schemaPath?: string // RFC 6901 pointer into valueSchema
  message: string
}

/**
 * Structural validation result.
 */
export type StructuralResult = {
  valid: boolean
  issues: StructuralIssue[]
}

/**
 * Combined evaluation result from both authorities.
 */
export type EvaluateResult = {
  availability: Record<string, FieldStatus>
  structure: StructuralResult
}

/**
 * Canonical inline profile document.
 */
export type ProfileDocument = {
  $schema: 'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json'
  profileVersion: 1
  valueSchema: Record<string, unknown>
  umpire: UmpireJsonSchema
}

/**
 * Profile compilation result.
 */
export type CompileProfileResult<
  C extends Record<string, unknown> = Record<string, unknown>,
> =
  | { ok: true; profile: CompiledProfile<C> }
  | { ok: false; issues: ProfileDefinitionIssue[] }

/**
 * Compiled profile interface.
 */
export interface CompiledProfile<
  C extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Umpire availability check (delegates to hydrated Umpire evaluator). */
  check(
    values: InputValues,
    conditions?: C,
    prev?: InputValues,
  ): Record<string, FieldStatus>

  /** JSON Schema structural validation against raw values. */
  validateStructure(values: unknown): StructuralResult

  /** Both authorities in one call. */
  evaluate(
    values: InputValues,
    conditions?: C,
    prev?: InputValues,
  ): EvaluateResult
}

/**
 * A generic JSON object.
 */
export type JsonObject = Record<string, unknown>

/**
 * Input for compileSchemas() — separately supplied authorities.
 */
export type ComposeInput = {
  valueSchema: unknown
  umpire: unknown
}
