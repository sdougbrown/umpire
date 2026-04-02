import type { FieldDef, Foul } from './types.js'

export function foulMap<F extends Record<string, FieldDef>>(
  fouls: Foul<F>[],
): Partial<Record<keyof F & string, Foul<F>>> {
  const map: Partial<Record<keyof F & string, Foul<F>>> = {}

  for (const foul of fouls) {
    map[foul.field] = foul
  }

  return map
}
