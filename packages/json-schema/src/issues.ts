import type { FieldStatus } from '@umpire/core'
import type { StructuralIssue } from './schema.js'

function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~')
}

function pointerSegments(pointer: string): string[] {
  return pointer.split('/').filter(Boolean).map(unescapePointerSegment)
}

function nodeAtPointer(raw: unknown, pointer: string): unknown {
  let node = raw
  for (const segment of pointerSegments(pointer)) {
    if (Array.isArray(node)) {
      node = node[Number(segment)]
    } else if (node !== null && typeof node === 'object') {
      node = (node as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return node
}

type AjvError = {
  keyword: string
  instancePath?: string
  schemaPath?: string
  params?: Record<string, unknown>
  message?: string
}

type DiscriminatorParams = {
  error?: 'tag' | 'mapping'
  tag?: string
  tagValue?: unknown
}

/** Normalize AJV errors into sorted, deduplicated structural issues. */
// eslint-disable-next-line complexity -- flat per-keyword mapping over a closed set of structural keywords
export function normalizeAjvErrors(
  errors: AjvError[],
  rawValue?: unknown,
): StructuralIssue[] {
  const issues: StructuralIssue[] = []
  const seen = new Set<string>()

  // Root type error suppresses all descendant issues
  const rootTypeErr = errors.some(
    (e) => e.keyword === 'type' && !e.instancePath,
  )

  for (const err of errors) {
    const ip = err.instancePath ?? ''
    if (rootTypeErr && ip !== '') continue // Skip descendant issues if a root type error exists

    let code: string
    let path: string

    if (err.keyword === 'discriminator') {
      const params = (err.params ?? {}) as DiscriminatorParams
      const tagName = params.tag ?? ''
      // A missing discriminator is reported as `required` at the property
      // path; an unknown (or non-string) discriminator is `discriminator`.
      const missing =
        params.error === 'tag' && !propertyPresent(rawValue, ip, tagName)
      code = missing ? 'required' : 'discriminator'
      path = `${ip}/${escapePointerToken(tagName)}`
    } else if (err.keyword === 'required') {
      const mp = err.params?.missingProperty as string
      const token = escapePointerToken(mp)
      path = ip ? `${ip}/${token}` : `/${token}`
      code = err.keyword
    } else if (err.keyword === 'additionalProperties') {
      const ap = err.params?.additionalProperty as string
      const token = escapePointerToken(ap)
      path = ip ? `${ip}/${token}` : `/${token}`
      code = err.keyword
    } else {
      path = ip || '/'
      code = err.keyword
    }

    const key = `${code}:${path}`
    if (seen.has(key)) continue
    seen.add(key)

    issues.push({
      source: 'json-schema',
      code,
      path,
      schemaPath: err.schemaPath || undefined,
      message: err.message ?? `Validation failed for ${code}`,
    })
  }

  issues.sort((a, b) => {
    const pc = a.path.localeCompare(b.path)
    return pc !== 0 ? pc : a.code.localeCompare(b.code)
  })
  return issues
}

// Value-dependent keywords (enum, const, bounds, lengths) are redundant once
// `type` fails at the same path. Drop them on any path carrying a `type`
// error; nested paths are unaffected.
const TYPE_DEPENDENT = new Set([
  'enum',
  'const',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
])

/** Drop structural issues at paths that already carry a `type` failure. */
export function suppressTypeDependents(
  issues: StructuralIssue[],
): StructuralIssue[] {
  const typePaths = new Set(
    issues.filter((i) => i.code === 'type').map((i) => i.path),
  )
  return issues.filter(
    (i) => !(TYPE_DEPENDENT.has(i.code) && typePaths.has(i.path)),
  )
}

function propertyPresent(
  rawValue: unknown,
  instancePointer: string,
  property: string,
): boolean {
  const node = nodeAtPointer(rawValue, instancePointer)
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return false
  }
  return Object.prototype.hasOwnProperty.call(node, property)
}

function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1')
}

/** Drop structural issues whose first path token names a disabled Umpire field. */
export function filterStructuralIssues(
  availability: Record<string, FieldStatus>,
  issues: StructuralIssue[],
): StructuralIssue[] {
  return issues.filter((issue) => {
    if (issue.path === '/') return true
    const first = issue.path.split('/').filter(Boolean)[0]
    if (!first) return true
    // Unescape RFC 6901 escape sequences: ~0 → ~, ~1 → /
    const field = first.replace(/~1/g, '/').replace(/~0/g, '~')
    const st = availability[field]
    return !(st && !st.enabled)
  })
}
