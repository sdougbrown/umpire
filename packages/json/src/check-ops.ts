import type { JsonPrimitive, NamedCheck, NamedCheckMetadata } from '@umpire/core'

import type { JsonCheckRule, JsonCheckOp } from './schema.js'

type Params = Readonly<Record<string, JsonPrimitive>>

const EMAIL_REGEX = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/

function createNamedCheck<T>(
  name: JsonCheckOp,
  validate: (value: NonNullable<T>) => boolean,
  params?: Params,
): NamedCheck<T> {
  if (!params) {
    return Object.freeze({
      __check: name,
      validate,
    })
  }

  return Object.freeze({
    __check: name,
    params,
    validate,
  })
}

function isLengthLike(value: unknown): value is { length: number } {
  return (typeof value === 'string' || Array.isArray(value)) && typeof value.length === 'number'
}

export const checks = Object.freeze({
  email() {
    return createNamedCheck<string>('email', (value) => EMAIL_REGEX.test(value))
  },
  url() {
    return createNamedCheck<string>('url', (value) => {
      try {
        const url = new URL(value)
        return url.protocol.length > 0
      } catch {
        return false
      }
    })
  },
  matches(pattern: string) {
    const regex = new RegExp(pattern)
    return createNamedCheck<string>('matches', (value) => regex.test(value), { pattern })
  },
  minLength(value: number) {
    return createNamedCheck<string | unknown[]>('minLength', (input) =>
      isLengthLike(input) && input.length >= value, { value })
  },
  maxLength(value: number) {
    return createNamedCheck<string | unknown[]>('maxLength', (input) =>
      isLengthLike(input) && input.length <= value, { value })
  },
  min(value: number) {
    return createNamedCheck<number>('min', (input) => typeof input === 'number' && input >= value, {
      value,
    })
  },
  max(value: number) {
    return createNamedCheck<number>('max', (input) => typeof input === 'number' && input <= value, {
      value,
    })
  },
  range(min: number, max: number) {
    return createNamedCheck<number>(
      'range',
      (input) => typeof input === 'number' && input >= min && input <= max,
      { min, max },
    )
  },
  integer() {
    return createNamedCheck<number>('integer', (input) => Number.isInteger(input))
  },
})

export function defaultCheckReason(rule: JsonCheckRule | NamedCheckMetadata): string {
  const metadata = 'op' in rule
    ? ({ __check: rule.op, params: paramsFromCheckRule(rule) } satisfies NamedCheckMetadata)
    : rule

  switch (metadata.__check) {
    case 'email':
      return 'Must be a valid email address'
    case 'url':
      return 'Must be a valid URL'
    case 'matches':
      return 'Must match the required format'
    case 'minLength':
      return `Must be at least ${metadata.params?.value} characters`
    case 'maxLength':
      return `Must be ${metadata.params?.value} characters or fewer`
    case 'min':
      return `Must be at least ${metadata.params?.value}`
    case 'max':
      return `Must be ${metadata.params?.value} or less`
    case 'range':
      return `Must be between ${metadata.params?.min} and ${metadata.params?.max}`
    case 'integer':
      return 'Must be a whole number'
    default:
      return 'Invalid value'
  }
}

function paramsFromCheckRule(rule: JsonCheckRule): Params | undefined {
  switch (rule.op) {
    case 'matches':
      return { pattern: rule.pattern }
    case 'minLength':
    case 'maxLength':
    case 'min':
    case 'max':
      return { value: rule.value }
    case 'range':
      return { min: rule.min, max: rule.max }
    default:
      return undefined
  }
}

export function createNamedCheckFromRule(rule: JsonCheckRule): NamedCheck<any> {
  switch (rule.op) {
    case 'email':
      return checks.email()
    case 'url':
      return checks.url()
    case 'matches':
      return checks.matches(rule.pattern)
    case 'minLength':
      return checks.minLength(rule.value)
    case 'maxLength':
      return checks.maxLength(rule.value)
    case 'min':
      return checks.min(rule.value)
    case 'max':
      return checks.max(rule.value)
    case 'range':
      return checks.range(rule.min, rule.max)
    case 'integer':
      return checks.integer()
  }
}

export function assertValidCheckRule(rule: JsonCheckRule): void {
  switch (rule.op) {
    case 'email':
    case 'url':
    case 'integer':
      return
    case 'matches':
      try {
        new RegExp(rule.pattern)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`[umpire/json] Invalid regex pattern "${rule.pattern}": ${message}`)
      }
      return
    case 'minLength':
    case 'maxLength':
    case 'min':
    case 'max':
      if (typeof rule.value !== 'number' || Number.isNaN(rule.value)) {
        throw new Error(`[umpire/json] Check rule "${rule.op}" requires a numeric value`)
      }
      return
    case 'range':
      if (
        typeof rule.min !== 'number' ||
        Number.isNaN(rule.min) ||
        typeof rule.max !== 'number' ||
        Number.isNaN(rule.max)
      ) {
        throw new Error('[umpire/json] Check rule "range" requires numeric min and max values')
      }
      return
    default:
      throw new Error(`[umpire/json] Unknown named check op "${String((rule as { op?: unknown }).op)}"`)
  }
}
