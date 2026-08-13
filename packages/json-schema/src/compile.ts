import { umpire } from '@umpire/core'
import { fromJsonSafe, type UmpireJsonSchema } from '@umpire/json'
import { isPlainRecord } from '@umpire/core/guards'
import Ajv from 'ajv/dist/2020.js'

import type {
  CompileProfileResult,
  CompiledProfile,
  ProfileDocument,
  ProfileDefinitionIssue,
  StructuralResult,
  EvaluateResult,
  ComposeInput,
} from './schema.js'
import { DEFINITION_ISSUE_CODES } from './schema.js'
import type { FieldStatus, InputValues } from '@umpire/core'
import { PROFILE_META_SCHEMA, checkProfileConsistency } from './consistency.js'
import { prepareValueSchema } from './discriminator.js'
import { normalizeAjvErrors, suppressTypeDependents } from './issues.js'

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

  // 3. Run consistency checks before compilation so definition issues surface
  //    with specific codes (such as field mismatch) instead of a generic AJV
  //    compile error.
  const consistencyIssues = checkProfileConsistency(
    profile.valueSchema,
    profile.umpire,
  )
  if (consistencyIssues.length > 0) {
    return { ok: false, issues: consistencyIssues }
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

  // 5. Compile the value schema with AJV 2020-12 (tagged unions
  //    use AJV's discriminator keyword, injected from the branch structure).
  //    Strict mode is off because the canonical schema declares unions as
  //    bare `oneOf` without `type: "object"` on the union node itself, which
  //    AJV's strictTypes rule would otherwise flag. Profile-definition
  //    rejection is owned by the closed-vocabulary + consistency checks.
  const vsAjv = new Ajv({
    allErrors: true,
    discriminator: true,
    strict: false,
    strictNumbers: true,
  })
  vsAjv.addKeyword({
    keyword: 'safeInteger',
    type: 'number',
    schemaType: 'boolean',
    validate: (_schema: boolean, value: number) => Number.isSafeInteger(value),
  })
  let valueValidate: ReturnType<typeof vsAjv.compile>
  try {
    valueValidate = vsAjv.compile(prepareValueSchema(profile.valueSchema))
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

  // 5b. Every Umpire default must validate against its property schema.
  const defaultIssues = validateDefaults(
    profile.valueSchema,
    profile.umpire,
    valueValidate,
  )
  if (defaultIssues.length > 0) {
    return { ok: false, issues: defaultIssues }
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
 * Validate every Umpire default against the corresponding value-schema
 * property using the already-compiled structural validator. Each default is
 * probed on its own so a violation is reported at /<field> and surfaced as
 * an INVALID_DEFAULT at the field's default path.
 */
function validateDefaults(
  valueSchema: Record<string, unknown>,
  umpireDoc: UmpireJsonSchema,
  validate: ReturnType<typeof Ajv.prototype.compile>,
): ProfileDefinitionIssue[] {
  const issues: ProfileDefinitionIssue[] = []

  for (const [name, fd] of Object.entries(umpireDoc.fields ?? {})) {
    if (!isPlainRecord(fd) || !('default' in fd)) continue
    const probe: Record<string, unknown> = { [name]: fd.default }
    const ok = validate(probe)
    if (ok) continue
    const errs = validate.errors ?? []
    const ownIssue = normalizeAjvErrors(errs, probe).some(
      (i) => i.path === `/${name}`,
    )
    if (ownIssue) {
      issues.push({
        code: C.INVALID_DEFAULT,
        path: `/umpire/fields/${name}/default`,
        message: `Default ${JSON.stringify(fd.default)} does not validate against property schema`,
      })
    }
  }
  return issues
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

    const issues = suppressTypeDependents(normalizeAjvErrors(errors, values))
    return { valid: false, issues }
  }

  evaluate(
    values: InputValues,
    conditions?: C,
    prev?: InputValues,
  ): EvaluateResult {
    const availability = this.check(values, conditions, prev)
    const structure = this.validateStructure(values)
    return { availability, structure }
  }
}
