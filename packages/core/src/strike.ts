import type { FieldDef, FieldValues, Foul } from './types.js'

export function strike<F extends Record<string, FieldDef>>(
  values: FieldValues<F>,
  fouls: readonly Foul<F>[],
): FieldValues<F> {
  if (fouls.length === 0) {
    return values
  }

  const next = { ...values }

  for (const foul of fouls) {
    next[foul.field] = foul.suggestedValue as FieldValues<F>[keyof F & string]
  }

  return next
}
