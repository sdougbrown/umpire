import type { z } from 'zod'
import type { AvailabilityMap, FieldDef } from '@umpire/core'

type FieldSchemas<F extends Record<string, FieldDef>> = Partial<
  Record<keyof F & string, z.ZodTypeAny>
>

/**
 * Pass per-field schemas directly, or use `yourSchema.shape` to extract
 * them from an existing `z.object()`.
 *
 * ```ts
 * // Per-field
 * activeSchema(availability, { email: z.string().email() }, z)
 *
 * // From an existing z.object()
 * activeSchema(availability, formSchema.shape, z)
 * ```
 */
export function activeSchema<F extends Record<string, FieldDef>>(
  availability: AvailabilityMap<F>,
  schemas: FieldSchemas<F>,
  zod: {
    object(shape: Record<string, z.ZodTypeAny>): z.ZodObject<Record<string, z.ZodTypeAny>>
  },
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  // Catch the common mistake of passing a z.object() instead of its .shape
  if ('_def' in schemas || '_zod' in schemas) {
    throw new Error(
      '[@umpire/zod] activeSchema() expects per-field schemas, not a z.object(). ' +
      'Pass formSchema.shape instead of formSchema.',
    )
  }

  const fieldSchemas = schemas

  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [field, status] of Object.entries(availability) as Array<
    [keyof F & string, AvailabilityMap<F>[keyof F & string]]
  >) {
    if (!status.enabled) {
      continue
    }

    const base = fieldSchemas[field]
    if (!base) {
      continue
    }

    shape[field] = status.required ? base : base.optional()
  }

  return zod.object(shape)
}
