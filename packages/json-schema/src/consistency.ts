import { isPlainRecord } from '@umpire/core/guards'
import type { UmpireJsonSchema } from '@umpire/json'
import type { ProfileDefinitionIssue } from './schema.js'

// ── Provisional profile meta-schema (Stage 4 will use the published URL) ──
export const PROFILE_META_SCHEMA: Record<string, unknown> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    $schema: {
      type: 'string',
      const:
        'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
    },
    profileVersion: { type: 'integer', const: 1 },
    valueSchema: {
      type: 'object',
      properties: {
        $schema: {
          type: 'string',
          const: 'https://json-schema.org/draft/2020-12/schema',
        },
      },
      required: ['$schema'],
    },
    umpire: { type: 'object' },
  },
  required: ['$schema', 'profileVersion', 'valueSchema', 'umpire'],
  additionalProperties: false,
}

// ── Closed profile v1 vocabulary ──
const SUPPORTED = new Set([
  '$schema',
  '$defs',
  '$ref',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'enum',
  'const',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'title',
  'description',
  'oneOf',
])

const ALLOWED_TYPES = new Set([
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
])

const SCALAR_TYPES = new Set(['string', 'number', 'integer', 'boolean'])

const IS_EMPTY_OK: Record<string, readonly string[]> = {
  string: ['string'],
  number: ['number', 'integer'],
  boolean: ['boolean'],
  array: ['array'],
  object: ['object'],
  present: ['string', 'number', 'integer', 'boolean', 'array', 'object'],
}

const C = {
  INVALID_PROFILE: 'invalidProfile',
  UNSUPPORTED_KEYWORD: 'unsupportedKeyword',
  FIELD_MISMATCH: 'fieldMismatch',
  INCOMPATIBLE_IS_EMPTY: 'incompatibleIsEmpty',
  INVALID_DEFAULT: 'invalidDefault',
  INVALID_REFERENCE: 'invalidReference',
  REFERENCE_CYCLE: 'referenceCycle',
  INVALID_DISCRIMINATOR: 'invalidDiscriminator',
} as const

function issue(
  code: string,
  path: string,
  message: string,
): ProfileDefinitionIssue {
  return { code, path, message }
}

// ── Entry point ──
export function checkProfileConsistency(
  vs: Record<string, unknown>,
  umpire: UmpireJsonSchema,
): ProfileDefinitionIssue[] {
  const issues: ProfileDefinitionIssue[] = []

  // 1. Dialect check
  if (typeof vs.$schema !== 'string') {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema/$schema',
        'valueSchema must include a $schema string',
      ),
    )
  } else if (vs.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema/$schema',
        `Unsupported dialect "${vs.$schema}". Profile v1 requires draft 2020-12.`,
      ),
    )
  }

  // 2. Root shape
  if (vs.type !== 'object')
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema/type',
        'Root type must be "object"',
      ),
    )
  if (
    !isPlainRecord(vs.properties) ||
    Object.keys(vs.properties).length === 0
  ) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema/properties',
        'Must include a non-empty properties object',
      ),
    )
  }
  if (vs.additionalProperties !== false) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema/additionalProperties',
        'Must declare additionalProperties: false at root',
      ),
    )
  }

  // 3. Field ↔ property correspondence
  const valueProps = isPlainRecord(vs.properties)
    ? Object.keys(vs.properties)
    : []
  const umpFields = Object.keys(umpire.fields ?? {})
  const valSet = new Set(valueProps)
  const umpSet = new Set(umpFields)
  for (const f of umpFields)
    if (!valSet.has(f))
      issues.push(
        issue(
          C.FIELD_MISMATCH,
          '/valueSchema/properties',
          `Umpire field "${f}" has no matching value schema property`,
        ),
      )
  for (const p of valueProps)
    if (!umpSet.has(p))
      issues.push(
        issue(
          C.FIELD_MISMATCH,
          `/valueSchema/properties/${p}`,
          `Value schema property "${p}" has no matching Umpire field`,
        ),
      )

  // 4. Default compatibility
  if (isPlainRecord(vs.properties)) {
    for (const [name, fd] of Object.entries(umpire.fields ?? {})) {
      if (fd.default === undefined) continue
      const ps = vs.properties[name] as Record<string, unknown> | undefined
      if (!ps) continue
      const t = ps.type
      const ok =
        typeof t !== 'string'
          ? true
          : t === 'string'
            ? typeof fd.default === 'string'
            : t === 'number'
              ? typeof fd.default === 'number' && Number.isFinite(fd.default)
              : t === 'integer'
                ? typeof fd.default === 'number' && Number.isInteger(fd.default)
                : t === 'boolean'
                  ? typeof fd.default === 'boolean'
                  : t === 'array'
                    ? Array.isArray(fd.default)
                    : t === 'object'
                      ? typeof fd.default === 'object' &&
                        fd.default !== null &&
                        !Array.isArray(fd.default)
                      : true
      if (!ok)
        issues.push(
          issue(
            C.INVALID_DEFAULT,
            `/umpire/fields/${name}/default`,
            `Default ${JSON.stringify(fd.default)} incompatible with value schema type "${t}"`,
          ),
        )
    }
  }

  // 5. isEmpty compatibility
  if (isPlainRecord(vs.properties)) {
    for (const [name, fd] of Object.entries(umpire.fields ?? {})) {
      if (!fd.isEmpty) continue
      const ps = vs.properties[name] as Record<string, unknown> | undefined
      if (!ps) continue
      const compat = IS_EMPTY_OK[fd.isEmpty]
      if (compat && typeof ps.type === 'string' && !compat.includes(ps.type)) {
        issues.push(
          issue(
            C.INCOMPATIBLE_IS_EMPTY,
            `/umpire/fields/${name}/isEmpty`,
            `isEmpty "${fd.isEmpty}" incompatible with schema type "${ps.type}"`,
          ),
        )
      }
    }
  }

  // 6. Root required references
  if (Array.isArray(vs.required)) {
    for (const r of vs.required)
      if (typeof r === 'string' && !valSet.has(r)) {
        issues.push(
          issue(
            C.INVALID_PROFILE,
            '/valueSchema/required',
            `Required property "${r}" not declared in properties`,
          ),
        )
      }
  }

  // 7. Closed-vocabulary walk
  walk(vs, '', issues, new Set())
  return issues
}

// ── Recursive schema walk ──
function walk(
  node: unknown,
  ptr: string,
  issues: ProfileDefinitionIssue[],
  visited: Set<string>,
): void {
  if (!isPlainRecord(node)) return

  // Cycle detection for $ref
  if (typeof node.$ref === 'string') {
    if (visited.has(node.$ref)) {
      issues.push(
        issue(
          C.REFERENCE_CYCLE,
          ptr || '/',
          `Circular reference "${node.$ref}"`,
        ),
      )
      return
    }
    visited.add(node.$ref)

    // Validate $ref format
    if (!/^#\/\$defs\//.test(node.$ref)) {
      issues.push(
        issue(
          C.INVALID_REFERENCE,
          `${ptr}/\$ref`,
          `Only #/\$defs/<name> references are supported, got "${node.$ref}"`,
        ),
      )
    }
    // Reject sibling keywords
    const sk = Object.keys(node).filter((k) => k !== '$ref')
    if (sk.length)
      issues.push(
        issue(
          C.INVALID_REFERENCE,
          ptr,
          `$ref must not have sibling keywords: ${sk.join(', ')}`,
        ),
      )
    return
  }

  // Unsupported keyword check
  for (const k of Object.keys(node)) {
    if (!SUPPORTED.has(k)) {
      issues.push(
        issue(C.UNSUPPORTED_KEYWORD, ptr || '/', `Unsupported keyword "${k}"`),
      )
    }
  }

  // Type check
  if (node.type !== undefined) {
    if (typeof node.type === 'string' && !ALLOWED_TYPES.has(node.type)) {
      issues.push(
        issue(
          C.UNSUPPORTED_KEYWORD,
          `${ptr}/type`,
          `Unsupported type "${node.type}"`,
        ),
      )
    }
    if (Array.isArray(node.type)) {
      issues.push(
        issue(
          C.UNSUPPORTED_KEYWORD,
          `${ptr}/type`,
          'Nullable type arrays not supported',
        ),
      )
    }
  }

  // Enum/const value compatibility
  if (
    Array.isArray(node.enum) &&
    typeof node.type === 'string' &&
    SCALAR_TYPES.has(node.type)
  ) {
    for (const v of node.enum)
      if (!compat(v, node.type)) {
        issues.push(
          issue(
            C.INVALID_PROFILE,
            `${ptr}/enum`,
            `Enum value ${JSON.stringify(v)} incompatible with type "${node.type}"`,
          ),
        )
      }
  }
  if (
    node.const !== undefined &&
    typeof node.type === 'string' &&
    SCALAR_TYPES.has(node.type)
  ) {
    if (!compat(node.const, node.type)) {
      issues.push(
        issue(
          C.INVALID_PROFILE,
          `${ptr}/const`,
          `Const value ${JSON.stringify(node.const)} incompatible with type "${node.type}"`,
        ),
      )
    }
  }

  // Array without items
  if (node.type === 'array' && node.items === undefined) {
    issues.push(
      issue(
        C.UNSUPPORTED_KEYWORD,
        `${ptr}/items`,
        'Arrays must declare a homogeneous items schema',
      ),
    )
  }
  if (Array.isArray(node.items)) {
    issues.push(
      issue(
        C.UNSUPPORTED_KEYWORD,
        `${ptr}/items`,
        'Tuple arrays not supported',
      ),
    )
  }

  // oneOf tagged-union validation
  if (Array.isArray(node.oneOf)) {
    validateOneOf(node.oneOf as Record<string, unknown>[], ptr, issues)
  }

  // Recurse — share visited set for cycle detection across the entire schema
  if (isPlainRecord(node.properties)) {
    for (const k of Object.keys(node.properties)) {
      walk(node.properties[k], `${ptr}/properties/${k}`, issues, visited)
    }
  }
  if (isPlainRecord(node.items)) {
    walk(node.items, `${ptr}/items`, issues, visited)
  }
  if (isPlainRecord(node.$defs)) {
    for (const k of Object.keys(node.$defs)) {
      walk(node.$defs[k], `${ptr}/\$defs/${k}`, issues, visited)
    }
  }
  if (Array.isArray(node.oneOf)) {
    for (let i = 0; i < node.oneOf.length; i++) {
      walk(node.oneOf[i], `${ptr}/oneOf/${i}`, issues, visited)
    }
  }
}

// ── Tagged-union validation (single pass) ──
function validateOneOf(
  branches: Record<string, unknown>[],
  ptr: string,
  issues: ProfileDefinitionIssue[],
): void {
  let discName: string | null = null
  const seenVals = new Set<unknown>()

  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]
    if (!isPlainRecord(b)) {
      issues.push(
        issue(
          C.INVALID_PROFILE,
          `${ptr}/oneOf/${i}`,
          `Branch ${i} must be an object schema`,
        ),
      )
      continue
    }
    if (b.type !== 'object') {
      issues.push(
        issue(
          C.INVALID_DISCRIMINATOR,
          `${ptr}/oneOf/${i}/type`,
          `Branch ${i} must be object for tagged unions`,
        ),
      )
      continue
    }

    // Find the discriminator const property
    const props = isPlainRecord(b.properties)
      ? (b.properties as Record<string, unknown>)
      : {}
    let foundDisc = false
    for (const [pk, pv] of Object.entries(props)) {
      if (!isPlainRecord(pv as Record<string, unknown>)) continue
      const cv = (pv as Record<string, unknown>).const
      if (cv === undefined) continue

      if (discName === null) discName = pk
      if (pk !== discName) continue // skip if this branch uses a different discriminator — caught below
      if (seenVals.has(cv)) {
        issues.push(
          issue(
            C.INVALID_DISCRIMINATOR,
            `${ptr}/oneOf/${i}`,
            `Duplicate discriminator const ${JSON.stringify(cv)}`,
          ),
        )
      }
      seenVals.add(cv)
      foundDisc = true

      // Check it's in required
      const req = Array.isArray(b.required) ? (b.required as string[]) : []
      if (!req.includes(pk)) {
        issues.push(
          issue(
            C.INVALID_DISCRIMINATOR,
            `${ptr}/oneOf/${i}/required`,
            `Branch ${i} must include "${pk}" in required`,
          ),
        )
      }
    }
    if (!foundDisc) {
      issues.push(
        issue(
          C.INVALID_DISCRIMINATOR,
          `${ptr}/oneOf/${i}`,
          `Branch ${i} must have a discriminator property with const`,
        ),
      )
    }
  }

  // Check uniform discriminator name
  let actualDisc: string | null = null
  for (const b of branches) {
    if (!isPlainRecord(b)) continue
    const props = isPlainRecord(b.properties)
      ? (b.properties as Record<string, unknown>)
      : {}
    for (const [pk, pv] of Object.entries(props)) {
      if (
        isPlainRecord(pv as Record<string, unknown>) &&
        (pv as Record<string, unknown>).const !== undefined
      ) {
        if (actualDisc === null) actualDisc = pk
        else if (pk !== actualDisc) {
          issues.push(
            issue(
              C.INVALID_DISCRIMINATOR,
              `${ptr}/oneOf`,
              `Branches must use the same discriminator property. Found "${actualDisc}" and "${pk}"`,
            ),
          )
          return // suppress duplicate messages
        }
      }
    }
  }
}

function compat(val: unknown, type: string): boolean {
  return type === 'string'
    ? typeof val === 'string'
    : type === 'number'
      ? typeof val === 'number' && Number.isFinite(val)
      : type === 'integer'
        ? typeof val === 'number' && Number.isInteger(val)
        : type === 'boolean'
          ? typeof val === 'boolean'
          : false
}
