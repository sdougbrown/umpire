import type {
  AvailabilityMap,
  FieldDef,
} from '@umpire/core'
import { activeErrors, zodErrors } from './active-errors.js'
import type { NormalizedFieldError } from './active-errors.js'

type ZodIssueLike = {
  path: readonly (string | number)[]
  message: string
}

type ZodErrorLike = {
  issues: readonly ZodIssueLike[]
}

type ZodSafeParseResultLike =
  | { success: true }
  | { success: false; error: ZodErrorLike }

type ValidationExtensionTone = 'accent' | 'enabled' | 'disabled' | 'fair' | 'muted'

type ValidationExtensionRow = {
  label: string
  value: unknown
}

type ValidationExtensionBadge = {
  tone?: ValidationExtensionTone
  value: unknown
}

type ValidationExtensionSection =
  | {
      kind: 'badges'
      title?: string
      badges: ValidationExtensionBadge[]
    }
  | {
      kind: 'rows'
      title?: string
      rows: ValidationExtensionRow[]
    }
  | {
      kind: 'items'
      title?: string
      items: Array<{
        id: string
        title: string
        badge?: ValidationExtensionBadge
        body?: string
        rows?: ValidationExtensionRow[]
      }>
    }

type ValidationExtensionView = {
  empty?: string
  sections: ValidationExtensionSection[]
}

type ValidationExtension<F extends Record<string, FieldDef>, C extends Record<string, unknown>> = {
  id: string
  label?: string
  inspect(): ValidationExtensionView | null
}

export type ZodValidationExtensionOptions<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown> = Record<string, unknown>,
> = {
  availability: AvailabilityMap<F>
  id?: string
  label?: string
  result: ZodSafeParseResultLike
  schemaFields?: readonly (keyof F & string)[] | readonly string[]
} & (
  | { normalizedErrors?: undefined }
  | { normalizedErrors: NormalizedFieldError[] }
)

function issueFieldLabel(field: string) {
  return field === '' ? '(form)' : field
}

function sectionRows<F extends Record<string, FieldDef>>(
  availability: AvailabilityMap<F>,
  issues: NormalizedFieldError[],
) {
  const suppressedIssues = issues.filter((issue) => {
    const state = availability[issue.field as keyof F & string]
    return state !== undefined && !state.enabled
  })
  const unknownIssues = issues.filter((issue) => availability[issue.field as keyof F & string] === undefined)

  return {
    suppressedIssues,
    unknownIssues,
  }
}

export function zodValidationExtension<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown> = Record<string, unknown>,
>(
  options: ZodValidationExtensionOptions<F, C>,
): ValidationExtension<F, C> {
  const {
    availability,
    id = 'validation',
    label = 'validation',
    result,
    schemaFields,
  } = options
  const normalizedErrors = options.normalizedErrors ??
    (result.success ? [] : zodErrors(result.error))
  const activeErrorMap = activeErrors(availability, normalizedErrors)
  const activeFieldCount = Object.values(availability).filter((field) => field.enabled).length
  const activeErrorCount = Object.keys(activeErrorMap).length
  const { suppressedIssues, unknownIssues } = sectionRows(availability, normalizedErrors)

  return {
    id,
    label,
    inspect() {
      const sections: ValidationExtensionSection[] = [{
        kind: 'badges',
        title: 'Summary',
        badges: [
          {
            tone: result.success ? 'enabled' : 'disabled',
            value: result.success ? 'valid' : 'invalid',
          },
          {
            tone: 'accent',
            value: `errors ${activeErrorCount}`,
          },
          {
            tone: 'muted',
            value: `suppressed ${suppressedIssues.length}`,
          },
          {
            tone: 'fair',
            value: `unmapped ${unknownIssues.length}`,
          },
          {
            tone: 'fair',
            value: `fields ${activeFieldCount}`,
          },
        ],
      }]

      if (Object.keys(activeErrorMap).length > 0) {
        sections.push({
          kind: 'rows',
          title: 'Active Error Map',
          rows: Object.entries(activeErrorMap).map(([field, message]) => ({
            label: field,
            value: message,
          })),
        })
      }

      if (schemaFields && schemaFields.length > 0) {
        sections.push({
          kind: 'rows',
          title: 'Active Schema',
          rows: [
            { label: 'field count', value: schemaFields.length },
            { label: 'fields', value: schemaFields.join(', ') },
          ],
        })
      }

      if (suppressedIssues.length > 0) {
        sections.push({
          kind: 'items',
          title: 'Suppressed Issues',
          items: suppressedIssues.map((issue, index) => {
            const state = availability[issue.field as keyof F & string]

            return {
              id: `${issue.field}:${index}`,
              title: issueFieldLabel(issue.field),
              badge: {
                tone: 'muted',
                value: 'disabled',
              },
              body: issue.message,
              rows: state?.reason
                ? [{ label: 'availability reason', value: state.reason }]
                : undefined,
            }
          }),
        })
      }

      if (unknownIssues.length > 0) {
        sections.push({
          kind: 'items',
          title: 'Unmapped Issues',
          items: unknownIssues.map((issue, index) => ({
            id: `${issue.field}:${index}`,
            title: issueFieldLabel(issue.field),
            badge: {
              tone: 'fair',
              value: 'unmapped',
            },
            body: issue.message,
          })),
        })
      }

      return {
        empty: 'No validation details available.',
        sections,
      }
    },
  }
}
