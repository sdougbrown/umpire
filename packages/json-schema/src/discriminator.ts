import { isPlainRecord } from '@umpire/core/guards'

/**
 * Profile v1 tagged unions are `oneOf` arrays whose branches share one
 * required discriminator property with a distinct string `const`. AJV selects
 * and validates the matching branch when the schema node carries a
 * `discriminator: { propertyName }` keyword, which also suppresses generic
 * `oneOf` branch noise.
 *
 * The closed-vocabulary consistency walk validates the original document, so
 * it must stay untouched. Because the canonical profile schema declares unions
 * with a bare `oneOf`, we derive the discriminator from the branches and inject
 * the keyword into a clone before AJV compilation. Integer nodes also receive
 * the implementation-only `safeInteger` keyword used by runtime validation.
 */
export function prepareValueSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const out = structuredClone(schema)
  walk(out)
  return out
}

// eslint-disable-next-line complexity -- recursively decorates each supported schema container without changing the source document
function walk(node: unknown): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const entry of node) walk(entry)
    return
  }
  if (!isPlainRecord(node)) return

  if (node.type === 'integer') {
    node.safeInteger = true
  }

  if (Array.isArray(node.oneOf)) {
    const tag = sharedDiscriminator(node.oneOf)
    if (tag) {
      node.discriminator = { propertyName: tag }
    }
  }

  if (isPlainRecord(node.properties)) {
    for (const key of Object.keys(node.properties)) {
      walk(node.properties[key])
    }
  }
  if (isPlainRecord(node.items)) {
    walk(node.items)
  }
  if (isPlainRecord(node.$defs)) {
    for (const key of Object.keys(node.$defs)) {
      walk(node.$defs[key])
    }
  }
  if (Array.isArray(node.oneOf)) {
    for (const branch of node.oneOf) walk(branch)
  }
}

/**
 * Return the shared discriminator property name for a tagged union, or `null`
 * if the branches do not describe a valid tagged union. The property must be
 * required in every branch and carry a distinct string `const`; other constant
 * properties do not affect discriminator selection.
 */
function sharedDiscriminator(branches: unknown[]): string | null {
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
    for (const [name, propSchema] of Object.entries(branch.properties)) {
      if (
        required.has(name) &&
        isPlainRecord(propSchema) &&
        typeof propSchema.const === 'string'
      ) {
        candidates.set(name, propSchema.const)
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
  return names.length === 1 ? names[0] : null
}
