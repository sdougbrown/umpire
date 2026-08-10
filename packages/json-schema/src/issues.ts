import type { FieldStatus } from '@umpire/core'
import type { StructuralIssue } from './schema.js'

/** Normalize AJV errors into sorted, deduplicated structural issues. */
export function normalizeAjvErrors(
  errors: NonNullable<import('ajv/dist/2020.js').ValidateFunction['errors']>,
): StructuralIssue[] {
  const issues: StructuralIssue[] = []
  const seen = new Set<string>()

  // Root type error suppresses all descendant issues
  const rootTypeErr = errors.some(
    (e) => e.keyword === 'type' && e.instancePath === '',
  )

  for (const err of errors) {
    const ip = err.instancePath ?? ''
    if (rootTypeErr && ip !== '') continue // Skip descendant issues if a root type error exists

    // Remap required → missing property path, additionalProperties → that prop path
    let path: string
    if (err.keyword === 'required') {
      const mp = err.params.missingProperty as string
      path = ip ? `${ip}/${mp}` : `/${mp}`
    } else if (err.keyword === 'additionalProperties') {
      const ap = err.params.additionalProperty as string
      path = ip ? `${ip}/${ap}` : `/${ap}`
    } else {
      path = ip || '/'
    }

    const code = err.keyword // keyword names are our codes
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
