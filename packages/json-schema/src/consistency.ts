import { isPlainRecord } from '@umpire/core/guards'
import type { UmpireJsonSchema } from '@umpire/json'
import type { ProfileDefinitionIssue } from './schema.js'
import { DEFINITION_ISSUE_CODES } from './schema.js'

export { PROFILE_META_SCHEMA } from './profile-meta.js'

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
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER
const C = DEFINITION_ISSUE_CODES

const GO_KEYWORDS = new Set([
  'break',
  'default',
  'func',
  'interface',
  'select',
  'case',
  'defer',
  'go',
  'map',
  'struct',
  'chan',
  'else',
  'goto',
  'package',
  'switch',
  'const',
  'fallthrough',
  'if',
  'range',
  'type',
  'continue',
  'for',
  'import',
  'return',
  'var',
])

const COMMON_KEYWORDS = new Set([
  'type',
  'title',
  'description',
  'enum',
  'const',
])

const TYPE_KEYWORDS: Record<string, ReadonlySet<string>> = {
  string: new Set(['minLength', 'maxLength']),
  number: new Set([
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
  ]),
  integer: new Set([
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
  ]),
  boolean: new Set(),
  array: new Set(['items', 'minItems', 'maxItems']),
  object: new Set(['properties', 'required', 'additionalProperties']),
}

const IS_EMPTY_OK: Record<string, readonly string[]> = {
  string: ['string'],
  number: ['number', 'integer'],
  boolean: ['boolean'],
  array: ['array'],
  object: ['object'],
  present: ['string', 'number', 'integer', 'boolean', 'array', 'object'],
}

type WalkContext = {
  root?: boolean
  allowUntypedConst?: boolean
  allowUntypedConstNames?: ReadonlySet<string>
}

function issue(
  code: string,
  path: string,
  message: string,
): ProfileDefinitionIssue {
  return { code, path, message }
}

/** Validate Profile v1 consistency and its closed, code-generatable vocabulary. */
export function checkProfileConsistency(
  vs: Record<string, unknown>,
  umpire: UmpireJsonSchema,
): ProfileDefinitionIssue[] {
  const issues: ProfileDefinitionIssue[] = []

  checkDialect(vs, issues)
  checkRootShape(vs, issues)
  checkFieldCorrespondence(vs, umpire, issues)

  const defs = isPlainRecord(vs.$defs)
    ? (vs.$defs as Record<string, unknown>)
    : {}
  walkSchema(vs, '/valueSchema', issues, defs, { root: true })
  checkReferenceCycles(defs, issues)
  checkCrossFieldCompatibility(vs, umpire, defs, issues)
  checkGoNames(vs, umpire, issues)

  return dedupeAndSortIssues(issues)
}

function checkDialect(
  vs: Record<string, unknown>,
  issues: ProfileDefinitionIssue[],
): void {
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
}

function checkRootShape(
  vs: Record<string, unknown>,
  issues: ProfileDefinitionIssue[],
): void {
  if (vs.type !== 'object') {
    issues.push(
      issue(C.INVALID_PROFILE, '/valueSchema', 'Root type must be "object"'),
    )
  }
  if (
    !isPlainRecord(vs.properties) ||
    Object.keys(vs.properties).length === 0
  ) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema',
        'Root must include a non-empty properties object',
      ),
    )
  }
  if (vs.additionalProperties === undefined) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema',
        'Root must declare additionalProperties: false',
      ),
    )
  } else if (vs.additionalProperties !== false) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        '/valueSchema/additionalProperties',
        'Root additionalProperties must be false',
      ),
    )
  }
}

function checkFieldCorrespondence(
  vs: Record<string, unknown>,
  umpire: UmpireJsonSchema,
  issues: ProfileDefinitionIssue[],
): void {
  const valueProps = isPlainRecord(vs.properties)
    ? Object.keys(vs.properties)
    : []
  const umpFields = Object.keys(umpire.fields ?? {})
  const valueNames = new Set(valueProps)
  const umpireNames = new Set(umpFields)

  for (const name of umpFields) {
    if (!valueNames.has(name)) {
      issues.push(
        issue(
          C.FIELD_MISMATCH,
          '/valueSchema',
          `Umpire field "${name}" has no matching value schema property`,
        ),
      )
    }
  }
  for (const name of valueProps) {
    if (!umpireNames.has(name)) {
      issues.push(
        issue(
          C.FIELD_MISMATCH,
          '/valueSchema',
          `Value schema property "${name}" has no matching Umpire field`,
        ),
      )
    }
  }
}

// eslint-disable-next-line complexity -- recursive validation over a deliberately closed schema vocabulary
function walkSchema(
  node: unknown,
  ptr: string,
  issues: ProfileDefinitionIssue[],
  defs: Record<string, unknown>,
  context: WalkContext = {},
): void {
  if (!isPlainRecord(node)) {
    issues.push(issue(C.INVALID_PROFILE, ptr, 'Schema node must be an object'))
    return
  }

  let hasUnsupportedKeyword = false
  for (const key of Object.keys(node)) {
    const rootOnly = (key === '$schema' || key === '$defs') && !context.root
    if (!SUPPORTED.has(key) || rootOnly) {
      hasUnsupportedKeyword = true
      issues.push(
        issue(
          C.UNSUPPORTED_KEYWORD,
          `${ptr}/${escapePointerToken(key)}`,
          `Unsupported keyword "${key}"`,
        ),
      )
    }
  }

  checkAnnotations(node, ptr, issues)

  if ('$ref' in node) {
    checkReference(node, ptr, defs, issues)
    return
  }

  if ('oneOf' in node) {
    if (context.root) {
      issues.push(
        issue(
          C.UNSUPPORTED_KEYWORD,
          `${ptr}/oneOf`,
          'Root unions are not supported',
        ),
      )
    } else {
      checkTaggedUnion(node, ptr, issues, defs)
      return
    }
  }

  if (
    context.allowUntypedConst &&
    !('type' in node) &&
    isConstOnlySchema(node)
  ) {
    if (typeof node.const !== 'string') {
      issues.push(
        issue(
          C.INVALID_DISCRIMINATOR,
          ptr,
          'A discriminator const must be a string',
        ),
      )
    }
    return
  }

  if (!('type' in node)) {
    if (!hasUnsupportedKeyword) {
      issues.push(
        issue(C.INVALID_PROFILE, ptr, 'Schema must declare an explicit type'),
      )
    }
    return
  }

  if (typeof node.type !== 'string' || !ALLOWED_TYPES.has(node.type)) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        `${ptr}/type`,
        'Schema type must be one supported scalar, array, or object type',
      ),
    )
    return
  }

  checkKeywordPlacement(node, node.type, ptr, issues, context.root === true)
  checkEnumAndConst(node, node.type, ptr, issues)
  checkNumericKeywords(node, node.type, ptr, issues)

  if (node.type === 'object') {
    walkObject(node, ptr, issues, defs, context)
  } else if (node.type === 'array') {
    walkArray(node, ptr, issues, defs)
  }
}

function checkAnnotations(
  node: Record<string, unknown>,
  ptr: string,
  issues: ProfileDefinitionIssue[],
): void {
  for (const key of ['title', 'description'] as const) {
    if (key in node && typeof node[key] !== 'string') {
      issues.push(
        issue(C.INVALID_PROFILE, `${ptr}/${key}`, `${key} must be a string`),
      )
    }
  }
}

function checkReference(
  node: Record<string, unknown>,
  ptr: string,
  defs: Record<string, unknown>,
  issues: ProfileDefinitionIssue[],
): void {
  const ref = node.$ref
  const name = typeof ref === 'string' ? localDefinitionName(ref) : null
  if (name === null || !(name in defs)) {
    issues.push(
      issue(
        C.INVALID_REFERENCE,
        `${ptr}/$ref`,
        `Reference ${JSON.stringify(ref)} is not a resolvable root $defs reference`,
      ),
    )
  }

  if (Object.keys(node).some((key) => key !== '$ref')) {
    issues.push(
      issue(C.INVALID_REFERENCE, ptr, '$ref must not have sibling keywords'),
    )
  }
}

function checkKeywordPlacement(
  node: Record<string, unknown>,
  schemaType: string,
  ptr: string,
  issues: ProfileDefinitionIssue[],
  root: boolean,
): void {
  const typeKeywords = TYPE_KEYWORDS[schemaType]
  for (const key of Object.keys(node)) {
    if (!SUPPORTED.has(key)) continue
    if (COMMON_KEYWORDS.has(key) || typeKeywords.has(key)) continue
    if (root && (key === '$schema' || key === '$defs')) continue
    if (key === 'oneOf') continue
    issues.push(
      issue(
        C.INVALID_PROFILE,
        `${ptr}/${escapePointerToken(key)}`,
        `Keyword "${key}" is not valid for type "${schemaType}"`,
      ),
    )
  }
}

// eslint-disable-next-line complexity -- strict object invariants are independent checks over one closed schema shape
function walkObject(
  node: Record<string, unknown>,
  ptr: string,
  issues: ProfileDefinitionIssue[],
  defs: Record<string, unknown>,
  context: WalkContext,
): void {
  if (!isPlainRecord(node.properties)) {
    issues.push(
      issue(C.INVALID_PROFILE, ptr, 'Object schemas require properties'),
    )
    return
  }

  if (node.additionalProperties === undefined) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        ptr,
        'Object schemas must declare additionalProperties: false',
      ),
    )
  } else if (node.additionalProperties !== false) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        `${ptr}/additionalProperties`,
        'Object schemas must set additionalProperties to false',
      ),
    )
  }

  const properties = node.properties
  if ('required' in node) {
    const required = node.required
    const valid =
      Array.isArray(required) &&
      required.every((name) => typeof name === 'string') &&
      new Set(required).size === required.length &&
      required.every((name) => name in properties)
    if (!valid) {
      issues.push(
        issue(
          C.INVALID_PROFILE,
          `${ptr}/required`,
          'required must contain unique names declared in properties',
        ),
      )
    }
  }

  for (const [name, child] of Object.entries(properties)) {
    const allowUntypedConst =
      context.allowUntypedConstNames?.has(name) === true &&
      isPlainRecord(child) &&
      'const' in child
    walkSchema(
      child,
      `${ptr}/properties/${escapePointerToken(name)}`,
      issues,
      defs,
      { allowUntypedConst },
    )
  }

  if (context.root && '$defs' in node) {
    if (!isPlainRecord(node.$defs)) {
      issues.push(
        issue(C.INVALID_PROFILE, `${ptr}/$defs`, '$defs must be an object'),
      )
    } else {
      for (const [name, child] of Object.entries(node.$defs)) {
        walkSchema(
          child,
          `${ptr}/$defs/${escapePointerToken(name)}`,
          issues,
          defs,
        )
      }
    }
  }
}

function walkArray(
  node: Record<string, unknown>,
  ptr: string,
  issues: ProfileDefinitionIssue[],
  defs: Record<string, unknown>,
): void {
  if (!('items' in node)) {
    issues.push(
      issue(C.INVALID_PROFILE, ptr, 'Array schemas must declare items'),
    )
    return
  }
  if (!isPlainRecord(node.items)) {
    issues.push(
      issue(
        C.INVALID_PROFILE,
        `${ptr}/items`,
        'Array items must be one homogeneous schema object',
      ),
    )
    return
  }
  walkSchema(node.items, `${ptr}/items`, issues, defs)
}

function checkTaggedUnion(
  node: Record<string, unknown>,
  ptr: string,
  issues: ProfileDefinitionIssue[],
  defs: Record<string, unknown>,
): void {
  const oneOfPath = `${ptr}/oneOf`
  const branches = node.oneOf
  let invalid =
    !Array.isArray(branches) ||
    branches.length === 0 ||
    Object.keys(node).some(
      (key) => key !== 'oneOf' && key !== 'title' && key !== 'description',
    )
  let discriminator: string | null = null

  if (!Array.isArray(branches)) {
    issues.push(
      issue(
        C.INVALID_DISCRIMINATOR,
        oneOfPath,
        'oneOf must be a non-empty tagged-union branch array',
      ),
    )
    return
  }

  const derived = deriveTaggedDiscriminator(branches)
  if (derived) discriminator = derived.name
  else invalid = true

  if (invalid || discriminator === null) {
    issues.push(
      issue(
        C.INVALID_DISCRIMINATOR,
        oneOfPath,
        'Branches must share one required discriminator with distinct string const values',
      ),
    )
  }

  for (let index = 0; index < branches.length; index++) {
    walkSchema(branches[index], `${oneOfPath}/${index}`, issues, defs, {
      allowUntypedConstNames:
        discriminator === null ? new Set() : new Set([discriminator]),
    })
  }
}

function checkEnumAndConst(
  node: Record<string, unknown>,
  schemaType: string,
  ptr: string,
  issues: ProfileDefinitionIssue[],
): void {
  if ('enum' in node) {
    const values = node.enum
    const valid =
      SCALAR_TYPES.has(schemaType) &&
      Array.isArray(values) &&
      values.length > 0 &&
      values.every((value) => valueMatchesType(value, schemaType)) &&
      new Set(values).size === values.length
    if (!valid) {
      issues.push(
        issue(
          C.INVALID_PROFILE,
          `${ptr}/enum`,
          'enum must be non-empty, unique, and compatible with its explicit scalar type',
        ),
      )
    }
    if (
      Array.isArray(values) &&
      values.some((value) => isUnsafeValue(value, schemaType))
    ) {
      issues.push(
        issue(
          C.UNSAFE_NUMBER,
          `${ptr}/enum`,
          'enum contains a number outside Profile v1 numeric limits',
        ),
      )
    }
  }

  if ('const' in node) {
    if (
      !SCALAR_TYPES.has(schemaType) ||
      !valueMatchesType(node.const, schemaType)
    ) {
      issues.push(
        issue(
          C.INVALID_PROFILE,
          `${ptr}/const`,
          'const must be compatible with its explicit scalar type',
        ),
      )
    }
    if (isUnsafeValue(node.const, schemaType)) {
      issues.push(
        issue(
          C.UNSAFE_NUMBER,
          `${ptr}/const`,
          'const is outside Profile v1 numeric limits',
        ),
      )
    }
  }
}

function checkNumericKeywords(
  node: Record<string, unknown>,
  schemaType: string,
  ptr: string,
  issues: ProfileDefinitionIssue[],
): void {
  for (const key of ['minItems', 'maxItems', 'minLength', 'maxLength']) {
    if (!(key in node)) continue
    const value = node[key]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      issues.push(
        issue(
          C.INVALID_PROFILE,
          `${ptr}/${key}`,
          `${key} must be a non-negative integer`,
        ),
      )
    } else if (!Number.isSafeInteger(value)) {
      issues.push(
        issue(
          C.UNSAFE_NUMBER,
          `${ptr}/${key}`,
          `${key} must be a safe integer`,
        ),
      )
    }
  }

  for (const key of [
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
  ]) {
    if (!(key in node)) continue
    const value = node[key]
    const unsafe =
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (schemaType === 'integer' && Math.abs(value) > MAX_SAFE_INTEGER)
    if (unsafe) {
      issues.push(
        issue(
          C.UNSAFE_NUMBER,
          `${ptr}/${key}`,
          `${key} is outside Profile v1 numeric limits`,
        ),
      )
    }
  }
}

function valueMatchesType(value: unknown, schemaType: string): boolean {
  switch (schemaType) {
    case 'string':
      return typeof value === 'string'
    case 'boolean':
      return typeof value === 'boolean'
    case 'number':
      return typeof value === 'number'
    case 'integer':
      return (
        typeof value === 'number' &&
        (!Number.isFinite(value) || Number.isInteger(value))
      )
    default:
      return false
  }
}

function isUnsafeValue(value: unknown, schemaType: string): boolean {
  if (typeof value !== 'number') return false
  if (!Number.isFinite(value)) return true
  return schemaType === 'integer' && !Number.isSafeInteger(value)
}

function checkCrossFieldCompatibility(
  vs: Record<string, unknown>,
  umpire: UmpireJsonSchema,
  defs: Record<string, unknown>,
  issues: ProfileDefinitionIssue[],
): void {
  if (!isPlainRecord(vs.properties)) return

  for (const [name, field] of Object.entries(umpire.fields ?? {})) {
    const propertySchema = vs.properties[name]
    const schemaType = resolveSchemaType(propertySchema, defs)
    if (field.isEmpty) {
      const compatible = IS_EMPTY_OK[field.isEmpty]
      if (schemaType && compatible && !compatible.includes(schemaType)) {
        issues.push(
          issue(
            C.INCOMPATIBLE_IS_EMPTY,
            `/umpire/fields/${escapePointerToken(name)}`,
            `isEmpty "${field.isEmpty}" is incompatible with schema type "${schemaType}"`,
          ),
        )
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(field, 'default') &&
      typeof field.default === 'number' &&
      ((!Number.isFinite(field.default) &&
        (schemaType === 'number' || schemaType === 'integer')) ||
        (schemaType === 'integer' && !Number.isSafeInteger(field.default)))
    ) {
      issues.push(
        issue(
          C.INVALID_DEFAULT,
          `/umpire/fields/${escapePointerToken(name)}/default`,
          'Default is outside Profile v1 numeric limits',
        ),
      )
    }
  }
}

function resolveSchemaType(
  raw: unknown,
  defs: Record<string, unknown>,
): string | undefined {
  const seen = new Set<string>()
  let node = raw
  while (isPlainRecord(node)) {
    if (typeof node.type === 'string') return node.type
    if (typeof node.$ref !== 'string') return undefined
    const name = localDefinitionName(node.$ref)
    if (name === null || seen.has(name)) return undefined
    seen.add(name)
    node = defs[name]
  }
  return undefined
}

function checkReferenceCycles(
  defs: Record<string, unknown>,
  issues: ProfileDefinitionIssue[],
): void {
  const graph = new Map<string, string[]>()
  for (const name of Object.keys(defs).sort()) {
    graph.set(
      name,
      collectReferences(defs[name]).filter((ref) => ref in defs),
    )
  }

  const state = new Map<string, 'active' | 'done'>()
  const reported = new Set<string>()
  const visit = (name: string): void => {
    state.set(name, 'active')
    for (const target of [...(graph.get(name) ?? [])].sort()) {
      if (state.get(target) === 'active') {
        if (!reported.has(name)) {
          reported.add(name)
          issues.push(
            issue(
              C.REFERENCE_CYCLE,
              `/valueSchema/$defs/${escapePointerToken(name)}`,
              `Definition "${name}" closes a reference cycle`,
            ),
          )
        }
      } else if (state.get(target) !== 'done') {
        visit(target)
      }
    }
    state.set(name, 'done')
  }

  for (const name of [...graph.keys()].sort()) {
    if (!state.has(name)) visit(name)
  }
}

function collectReferences(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectReferences)
  if (!isPlainRecord(node)) return []

  const refs: string[] = []
  if (typeof node.$ref === 'string') {
    const name = localDefinitionName(node.$ref)
    if (name !== null) refs.push(name)
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== '$ref') refs.push(...collectReferences(value))
  }
  return refs
}

function localDefinitionName(ref: string): string | null {
  const prefix = '#/$defs/'
  if (!ref.startsWith(prefix)) return null
  const token = ref.slice(prefix.length)
  if (!token || token.includes('/')) return null
  try {
    return unescapePointerToken(token)
  } catch {
    return null
  }
}

function unescapePointerToken(token: string): string {
  let out = ''
  for (let index = 0; index < token.length; index++) {
    const char = token[index]
    if (char !== '~') {
      out += char
      continue
    }
    const escaped = token[++index]
    if (escaped === '0') out += '~'
    else if (escaped === '1') out += '/'
    else throw new Error('Invalid RFC 6901 escape')
  }
  return out
}

function isConstOnlySchema(node: Record<string, unknown>): boolean {
  return Object.keys(node).every((key) =>
    ['const', 'title', 'description'].includes(key),
  )
}

function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1')
}

function dedupeAndSortIssues(
  issues: ProfileDefinitionIssue[],
): ProfileDefinitionIssue[] {
  const byKey = new Map<string, ProfileDefinitionIssue>()
  for (const current of issues) {
    const key = `${current.code}|${current.path}`
    if (!byKey.has(key)) byKey.set(key, current)
  }
  return [...byKey.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code),
  )
}

// ---- Go code-generation name audit ----

function checkGoNames(
  vs: Record<string, unknown>,
  umpire: UmpireJsonSchema,
  issues: ProfileDefinitionIssue[],
): void {
  // `Schema` is a neutral stand-in for the caller's configured prefix. Every
  // compared package symbol carries the same prefix, so collision outcomes do
  // not depend on the eventual SchemaName.
  const packageSymbols = new GeneratedSymbolTable(issues)
  for (const helper of [
    'Schema',
    'SchemaFields',
    'SchemaConditions',
    'SchemaAvailability',
    'SchemaStructuralIssue',
    'SchemaStructuralError',
    'ValidateSchemaJSON',
    'DecodeSchema',
  ]) {
    packageSymbols.reserve(helper)
  }

  if (isPlainRecord(vs.properties)) {
    checkNameCollection(
      Object.keys(vs.properties),
      '/valueSchema/properties',
      issues,
    )
    walkGeneratedNames(
      vs,
      'SchemaFields',
      '/valueSchema',
      issues,
      packageSymbols,
      { root: true, ownerDeclared: true },
    )
  }

  if (isPlainRecord(vs.$defs)) {
    checkNameCollection(Object.keys(vs.$defs), '/valueSchema/$defs', issues)
    for (const [name, schema] of Object.entries(vs.$defs)) {
      const owner = `Schema${goFieldName(name)}`
      packageSymbols.add(
        owner,
        `/valueSchema/$defs/${escapePointerToken(name)}`,
      )
      walkGeneratedNames(
        schema,
        owner,
        `/valueSchema/$defs/${escapePointerToken(name)}`,
        issues,
        packageSymbols,
        { ownerDeclared: true },
      )
    }
  }

  if (isPlainRecord(umpire.conditions)) {
    checkNameCollection(
      Object.keys(umpire.conditions),
      '/umpire/conditions',
      issues,
    )
  }
  checkRuleNames(umpire.rules, issues, packageSymbols)
}

// eslint-disable-next-line complexity -- recursively inventories each supported generated symbol category
function walkGeneratedNames(
  node: unknown,
  owner: string,
  ptr: string,
  issues: ProfileDefinitionIssue[],
  symbols: GeneratedSymbolTable,
  context: { root?: boolean; ownerDeclared?: boolean } = {},
): void {
  if (!isPlainRecord(node) || '$ref' in node) return

  if (Array.isArray(node.enum)) {
    const enumType = context.ownerDeclared ? owner : `${owner}Value`
    if (!context.ownerDeclared) symbols.add(enumType, `${ptr}/enum`)
    const constantNames = node.enum.map((value, index) =>
      enumConstantName(value, index),
    )
    checkConvertedValues(constantNames, `${ptr}/enum`, issues)
    for (const name of constantNames) {
      symbols.add(`${enumType}${goFieldName(name)}`, `${ptr}/enum`)
    }
  }

  if (Array.isArray(node.oneOf)) {
    const unionType = context.ownerDeclared ? owner : `${owner}Value`
    if (!context.ownerDeclared) symbols.add(unionType, `${ptr}/oneOf`)
    const values = discriminatorValues(node.oneOf)
    checkConvertedValues(values, `${ptr}/oneOf`, issues)
    for (const value of values) {
      symbols.add(`${unionType}${goFieldName(value)}`, `${ptr}/oneOf`)
    }
    for (let index = 0; index < node.oneOf.length; index++) {
      walkGeneratedNames(
        node.oneOf[index],
        `${unionType}${goFieldName(values[index] ?? `Variant${index + 1}`)}`,
        `${ptr}/oneOf/${index}`,
        issues,
        symbols,
        { ownerDeclared: true },
      )
    }
    return
  }

  if (node.type === 'object' && isPlainRecord(node.properties)) {
    checkNameCollection(
      Object.keys(node.properties),
      `${ptr}/properties`,
      issues,
    )
    for (const [name, child] of Object.entries(node.properties)) {
      const childPtr = `${ptr}/properties/${escapePointerToken(name)}`
      const childOwner = `${owner}${goFieldName(name)}`
      if (isGeneratedNamedSchema(child)) symbols.add(childOwner, childPtr)
      walkGeneratedNames(child, childOwner, childPtr, issues, symbols, {
        ownerDeclared: isGeneratedNamedSchema(child),
      })
    }
  }

  if (node.type === 'array' && isPlainRecord(node.items)) {
    const itemOwner = `${owner}Item`
    if (isGeneratedNamedSchema(node.items))
      symbols.add(itemOwner, `${ptr}/items`)
    walkGeneratedNames(node.items, itemOwner, `${ptr}/items`, issues, symbols, {
      ownerDeclared: isGeneratedNamedSchema(node.items),
    })
  }

  if (context.root && isPlainRecord(node.$defs)) {
    // Root definitions are handled once above so their package symbols use the
    // documented Schema+DefName owner rather than the property traversal owner.
  }
}

function isGeneratedNamedSchema(node: unknown): boolean {
  return isPlainRecord(node) && node.type === 'object'
}

function deriveTaggedDiscriminator(
  branches: unknown[],
): { name: string; values: string[] } | null {
  const branchCandidates: Array<Map<string, string>> = []
  for (const branch of branches) {
    if (
      !isPlainRecord(branch) ||
      branch.type !== 'object' ||
      !isPlainRecord(branch.properties) ||
      !Array.isArray(branch.required)
    ) {
      return null
    }
    const required = new Set(
      branch.required.filter(
        (name): name is string => typeof name === 'string',
      ),
    )
    const candidates = new Map<string, string>()
    for (const [name, schema] of Object.entries(branch.properties)) {
      if (
        required.has(name) &&
        isPlainRecord(schema) &&
        typeof schema.const === 'string'
      ) {
        candidates.set(name, schema.const)
      }
    }
    branchCandidates.push(candidates)
  }

  const names = [...(branchCandidates[0]?.keys() ?? [])].filter((name) => {
    const values = branchCandidates.map((candidates) => candidates.get(name))
    return (
      values.every((value): value is string => value !== undefined) &&
      new Set(values).size === branches.length
    )
  })
  if (names.length !== 1) return null
  return {
    name: names[0],
    values: branchCandidates.map((candidates) => candidates.get(names[0])!),
  }
}

function discriminatorValues(branches: unknown[]): string[] {
  return deriveTaggedDiscriminator(branches)?.values ?? []
}

function enumConstantName(value: unknown, index: number): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return `Value${index + 1}`
}

function checkRuleNames(
  rules: UmpireJsonSchema['rules'],
  issues: ProfileDefinitionIssue[],
  symbols: GeneratedSymbolTable,
  prefix = '/umpire/rules',
): void {
  const groups: string[] = []
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index]
    const ptr = `${prefix}/${index}`
    if (rule.type === 'oneOf' || rule.type === 'eitherOf') {
      groups.push(rule.group)
      checkSingleGoName(rule.group, `${ptr}/group`, issues)
      const branches = Object.keys(rule.branches)
      checkNameCollection(branches, `${ptr}/branches`, issues)
      const groupType = `Schema${goFieldName(rule.group)}Branch`
      symbols.add(groupType, `${ptr}/group`)
      for (const branch of branches) {
        symbols.add(
          `${groupType}${goFieldName(branch)}`,
          `${ptr}/branches/${escapePointerToken(branch)}`,
        )
      }
      if (rule.type === 'eitherOf') {
        for (const [branch, branchRules] of Object.entries(rule.branches)) {
          checkRuleNames(
            branchRules,
            issues,
            symbols,
            `${ptr}/branches/${escapePointerToken(branch)}`,
          )
        }
      }
    } else if (rule.type === 'anyOf') {
      checkRuleNames(rule.rules, issues, symbols, `${ptr}/rules`)
    }
  }
  checkConvertedValues(groups, prefix, issues)
}

function checkNameCollection(
  names: string[],
  containerPath: string,
  issues: ProfileDefinitionIssue[],
): void {
  const converted = new Map<string, string>()
  for (const name of names) {
    const itemPath = `${containerPath}/${escapePointerToken(name)}`
    const goName = checkSingleGoName(name, itemPath, issues)
    if (!goName) continue
    const prior = converted.get(goName)
    if (prior !== undefined && prior !== name) {
      issues.push(
        issue(
          C.NAME_COLLISION,
          containerPath,
          `Names "${prior}" and "${name}" both generate "${goName}"`,
        ),
      )
    } else {
      converted.set(goName, name)
    }
  }
}

function checkConvertedValues(
  values: string[],
  path: string,
  issues: ProfileDefinitionIssue[],
): void {
  const converted = new Set<string>()
  for (const value of values) {
    const goName = checkSingleGoName(value, path, issues)
    if (!goName) continue
    if (converted.has(goName)) {
      issues.push(
        issue(C.NAME_COLLISION, path, `Generated name "${goName}" collides`),
      )
    }
    converted.add(goName)
  }
}

function checkSingleGoName(
  name: string,
  path: string,
  issues: ProfileDefinitionIssue[],
): string | null {
  const converted = goFieldName(name)
  if (!isValidGeneratedGoIdentifier(converted) || GO_KEYWORDS.has(name)) {
    issues.push(
      issue(
        C.INVALID_NAME,
        path,
        `"${name}" does not generate a valid, non-keyword Go identifier`,
      ),
    )
    return null
  }
  return converted
}

/** Mirror codegen.GoFieldName: upper-case the first rune and separators' successor. */
function goFieldName(name: string): string {
  const runes = Array.from(name)
  if (runes.length === 0) return ''

  const output: string[] = [simpleUpper(runes[0])]
  let skipNext = false
  for (let index = 1; index < runes.length; index++) {
    const rune = runes[index]
    if (skipNext) {
      output.push(simpleUpper(rune))
      skipNext = false
    } else if (rune === '_' || !isGoLetterOrDigit(rune)) {
      skipNext = true
    } else {
      output.push(rune)
    }
  }
  return output.join('')
}

function simpleUpper(rune: string): string {
  const upper = rune.toUpperCase()
  return Array.from(upper).length === 1 ? upper : rune
}

function isGoLetterOrDigit(rune: string): boolean {
  return /[\p{L}\p{Nd}]/u.test(rune)
}

function isValidGeneratedGoIdentifier(name: string): boolean {
  return /^\p{Lu}[\p{L}\p{Nd}]*$/u.test(name)
}

class GeneratedSymbolTable {
  readonly #symbols = new Map<string, string | null>()
  readonly #issues: ProfileDefinitionIssue[]

  constructor(issues: ProfileDefinitionIssue[]) {
    this.#issues = issues
  }

  reserve(name: string): void {
    this.#symbols.set(name, null)
  }

  add(name: string, path: string): void {
    const prior = this.#symbols.get(name)
    if (prior !== undefined) {
      this.#issues.push(
        issue(
          C.NAME_COLLISION,
          path,
          prior === null
            ? `Generated symbol "${name}" collides with a reserved helper`
            : `Generated symbol "${name}" also comes from ${prior}`,
        ),
      )
      return
    }
    this.#symbols.set(name, path)
  }
}
