import type {
  FieldValidator,
  NamedCheck,
  SafeParseValidator,
  StringTestValidator,
} from './types.js'

export type NormalizedValidationEntry<T = unknown> = {
  validate: (value: NonNullable<T>) => boolean
  error?: string
}

export type ValidationResult = {
  valid: boolean
  error?: string
}

type ValidationEntryObject<T = unknown> = {
  validator: FieldValidator<T>
  error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSafeParseValidator<T = unknown>(validator: unknown): validator is SafeParseValidator<T> {
  return isRecord(validator) && typeof validator.safeParse === 'function'
}

function isStringTestValidator(validator: unknown): validator is StringTestValidator {
  return isRecord(validator) && typeof validator.test === 'function'
}

export function isNamedCheck<T = unknown>(validator: unknown): validator is NamedCheck<T> {
  return isRecord(validator) &&
    typeof validator.__check === 'string' &&
    typeof validator.validate === 'function'
}

function isFieldValidator<T = unknown>(validator: unknown): validator is FieldValidator<T> {
  return typeof validator === 'function' ||
    isNamedCheck<T>(validator) ||
    isSafeParseValidator<T>(validator) ||
    isStringTestValidator(validator)
}

function isValidationEntryObject<T = unknown>(entry: unknown): entry is ValidationEntryObject<T> {
  return isRecord(entry) &&
    'validator' in entry &&
    isFieldValidator<T>(entry.validator) &&
    (!('error' in entry) || entry.error === undefined || typeof entry.error === 'string')
}

function toValidationFunction<T = unknown>(
  validator: FieldValidator<T>,
): (value: NonNullable<T>) => boolean {
  if (typeof validator === 'function') {
    return validator
  }

  if (isNamedCheck<T>(validator)) {
    return validator.validate
  }

  if (isSafeParseValidator<T>(validator)) {
    return (value) => validator.safeParse(value).success
  }

  return (value) => typeof value === 'string' && validator.test(value)
}

export function normalizeValidationEntry<T = unknown>(
  entry: unknown,
): NormalizedValidationEntry<T> | null {
  if (isFieldValidator<T>(entry)) {
    return { validate: toValidationFunction(entry) }
  }

  if (!isValidationEntryObject<T>(entry)) {
    return null
  }

  const normalized: NormalizedValidationEntry<T> = {
    validate: toValidationFunction(entry.validator),
  }

  if (entry.error !== undefined) {
    normalized.error = entry.error
  }

  return normalized
}

export function runFieldValidator<T = unknown>(
  validator: FieldValidator<T>,
  value: NonNullable<T>,
): boolean {
  if (!isFieldValidator<T>(validator)) {
    return false
  }

  return toValidationFunction(validator)(value)
}

export function runValidationEntry<T = unknown>(
  entry: NormalizedValidationEntry<T>,
  value: NonNullable<T>,
): ValidationResult {
  const result: ValidationResult = { valid: entry.validate(value) }

  if (!result.valid && entry.error !== undefined) {
    result.error = entry.error
  }

  return result
}
