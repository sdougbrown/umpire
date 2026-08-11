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
 * the keyword into a clone before AJV compilation.
 */
export function applyDiscriminators<T>(schema: T): T {
  const out = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>
  walk(out)
  return out as T
}

function walk(node: unknown): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const entry of node) walk(entry)
    return
  }
  if (!isPlainRecord(node)) return

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
 * if the branches do not describe a valid tagged union. A discriminator
 * property is any branch property carrying a `const`. Every branch must use
 * the same property name.
 */
function sharedDiscriminator(branches: unknown[]): string | null {
  let tag: string | null = null
  for (const branch of branches) {
    if (!isPlainRecord(branch) || branch.type !== 'object') return null
    const props = isPlainRecord(branch.properties)
      ? (branch.properties as Record<string, unknown>)
      : {}
    let found = false
    for (const [name, propSchema] of Object.entries(props)) {
      if (!isPlainRecord(propSchema) || propSchema.const === undefined) continue
      if (tag === null) tag = name
      if (tag !== name) return null
      found = true
      break
    }
    if (!found) return null
  }
  return tag
}
