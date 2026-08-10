import { umpire } from '@umpire/core'
import { fromJsonSafe, type UmpireJsonSchema } from '@umpire/json'
import { isPlainRecord } from '@umpire/core/guards'
import Ajv from 'ajv/dist/2020.js'

import type {
  CompileProfileResult,
  CompiledProfile,
  ProfileDocument,
  ProfileDefinitionIssue,
  StructuralIssue,
  StructuralResult,
  EvaluateResult,
  ComposeInput,
} from './schema.js'
import type { FieldStatus, InputValues } from '@umpire/core'
import { PROFILE_META_SCHEMA, checkProfileConsistency } from './consistency.js'
const DEFINITION_ISSUE_CODES = {
  INVALID_PROFILE: 'invalidProfile',
  UNSUPPORTED_KEYWORD: 'unsupportedKeyword',
  FIELD_MISMATCH: 'fieldMismatch',
  INCOMPATIBLE_IS_EMPTY: 'incompatibleIsEmpty',
  INVALID_DEFAULT: 'invalidDefault',
  INVALID_REFERENCE: 'invalidReference',
  REFERENCE_CYCLE: 'referenceCycle',
  INVALID_DISCRIMINATOR: 'invalidDiscriminator',
  INVALID_NAME: 'invalidName',
  NAME_COLLISION: 'nameCollision',
  UNSAFE_NUMBER: 'unsafeNumber',
} as const
import { normalizeAjvErrors, filterStructuralIssues } from './issues.js'

const C = DEFINITION_ISSUE_CODES

/**
 * Parse and compile a canonical inline profile document.
 */
export function compileProfile<
  C extends Record<string, unknown> = Record<string, unknown>,
>(raw: unknown): CompileProfileResult<C> {
  // 1. Validate profile document shape
  const profileIssues = validateProfileShape(raw)
  if (profileIssues.length > 0) {
    return { ok: false, issues: profileIssues }
  }

  const profile = raw as ProfileDocument

  // 2. Validate with profile meta-schema
  const ajv = new Ajv({ allErrors: true })
  const profileValidate = ajv.compile(PROFILE_META_SCHEMA)
  if (!profileValidate(profile)) {
    const issues: ProfileDefinitionIssue[] = (profileValidate.errors ?? []).map(
      (err) => ({
        code: C.INVALID_PROFILE,
        path: err.instancePath || '/',
        message: err.message ?? 'Profile validation failed',
      }),
    )
    return { ok: false, issues }
  }

  // 3. Validate value schema with AJV 2020-12
  const vsAjv = new Ajv({ allErrors: true })
  let valueValidate: ReturnType<typeof vsAjv.compile>
  try {
    valueValidate = vsAjv.compile(profile.valueSchema)
  } catch (err) {
    return {
      ok: false,
      issues: [
        {
          code: C.INVALID_PROFILE,
          path: '/valueSchema',
          message: err instanceof Error ? err.message : 'Invalid value schema',
        },
      ],
    }
  }

  // 4. Hydrate Umpire from the umpire portion
  const hydration = fromJsonSafe<C>(profile.umpire)
  if (!hydration.ok) {
    return {
      ok: false,
      issues: [
        {
          code: C.INVALID_PROFILE,
          path: '/umpire',
          message: `Umpire hydration failed: ${hydration.errors.join('; ')}`,
        },
      ],
    }
  }

  // 5. Run consistency checks
  const consistencyIssues = checkProfileConsistency(
    profile.valueSchema,
    profile.umpire,
  )
  if (consistencyIssues.length > 0) {
    return { ok: false, issues: consistencyIssues }
  }

  // 6. Build the runtime
  const ump = umpire({
    fields: hydration.fields,
    rules: hydration.rules,
    validators: hydration.validators,
  })

  // 7. Return the compiled profile
  return {
    ok: true,
    profile: new InternalCompiledProfile(ump, valueValidate),
  }
}

/**
 * Compile separately-supplied schemas by wrapping them in a canonical profile.
 */
export function compileSchemas<
  C extends Record<string, unknown> = Record<string, unknown>,
>(input: ComposeInput): CompileProfileResult<C> {
  if (!isPlainRecord(input.valueSchema)) {
    return {
      ok: false,
      issues: [
        {
          code: C.INVALID_PROFILE,
          path: '/valueSchema',
          message: 'valueSchema must be an object',
        },
      ],
    }
  }

  if (!isPlainRecord(input.umpire)) {
    return {
      ok: false,
      issues: [
        {
          code: C.INVALID_PROFILE,
          path: '/umpire',
          message: 'umpire must be an object',
        },
      ],
    }
  }

  const profile: Record<string, unknown> = {
    $schema:
      'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
    profileVersion: 1,
    valueSchema: input.valueSchema,
    umpire: input.umpire,
  }

  return compileProfile<C>(profile)
}

/**
 * Validate the basic shape of a profile document before full validation.
 */
function validateProfileShape(raw: unknown): ProfileDefinitionIssue[] {
  const issues: ProfileDefinitionIssue[] = []

  if (!isPlainRecord(raw)) {
    issues.push({
      code: C.INVALID_PROFILE,
      path: '/',
      message: 'Profile must be an object',
    })
    return issues
  }

  if (raw.$schema === undefined) {
    issues.push({
      code: C.INVALID_PROFILE,
      path: '/$schema',
      message: 'Profile must include a $schema field',
    })
  }

  if (raw.profileVersion === undefined) {
    issues.push({
      code: C.INVALID_PROFILE,
      path: '/profileVersion',
      message: 'Profile must include a profileVersion field',
    })
  } else if (raw.profileVersion !== 1) {
    issues.push({
      code: C.INVALID_PROFILE,
      path: '/profileVersion',
      message: `Unsupported profile version "${String(raw.profileVersion)}"`,
    })
  }

  if (raw.valueSchema === undefined) {
    issues.push({
      code: C.INVALID_PROFILE,
      path: '/valueSchema',
      message: 'Profile must include a valueSchema field',
    })
  }

  if (raw.umpire === undefined) {
    issues.push({
      code: C.INVALID_PROFILE,
      path: '/umpire',
      message: 'Profile must include an umpire field',
    })
  }

  return issues
}

/**
 * Internal implementation of CompiledProfile.
 */
class InternalCompiledProfile<
  C extends Record<string, unknown> = Record<string, unknown>,
> implements CompiledProfile<C> {
  readonly #ump: ReturnType<typeof umpire>
  readonly #validate: ReturnType<typeof Ajv.prototype.compile>

  constructor(
    ump: ReturnType<typeof umpire>,
    validate: ReturnType<typeof Ajv.prototype.compile>,
  ) {
    this.#ump = ump
    this.#validate = validate
  }

  check(
    values: InputValues,
    conditions?: C,
    prev?: InputValues,
  ): Record<string, FieldStatus> {
    return this.#ump.check(values, conditions, prev) as Record<
      string,
      FieldStatus
    >
  }

  validateStructure(values: unknown): StructuralResult {
    const valid = this.#validate(values)

    if (valid) {
      return { valid: true, issues: [] }
    }

    const errors = this.#validate.errors
    if (!errors || errors.length === 0) {
      return { valid: true, issues: [] }
    }

    const issues = normalizeAjvErrors(errors)
    return { valid: false, issues }
  }

  evaluate(
    values: InputValues,
    conditions?: C,
    prev?: InputValues,
  ): EvaluateResult<C> {
    const availability = this.check(values, conditions, prev)
    const structure = this.validateStructure(values)
    return { availability, structure }
  }
}
