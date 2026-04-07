import { check, getNamedCheckMetadata } from '@umpire/core'

import { checks, createNamedCheckFromRule, defaultCheckReason } from '../src/index.js'

describe('checks', () => {
  test.each([
    ['email', checks.email(), 'user@example.com', 'invalid', 'Must be a valid email address'],
    ['url', checks.url(), 'https://example.com', '/relative', 'Must be a valid URL'],
    ['minLength', checks.minLength(3), 'abcd', 'ab', 'Must be at least 3 characters'],
    ['maxLength', checks.maxLength(3), 'abc', 'abcd', 'Must be 3 characters or fewer'],
    ['min', checks.min(3), 4, 2, 'Must be at least 3'],
    ['max', checks.max(3), 2, 4, 'Must be 3 or less'],
    ['range', checks.range(2, 4), 3, 5, 'Must be between 2 and 4'],
    ['integer', checks.integer(), 3, 3.5, 'Must be a whole number'],
  ])(
    'validates %s',
    (_label, validator, passingValue, failingValue, expectedReason) => {
      expect(validator.validate(passingValue as never)).toBe(true)
      expect(validator.validate(failingValue as never)).toBe(false)
      expect(defaultCheckReason(validator)).toBe(expectedReason)
    },
  )

  test('matches validates a serializable regex pattern', () => {
    const validator = checks.matches('^[a-z0-9_]+$')

    expect(validator.validate('umpire_ok')).toBe(true)
    expect(validator.validate('Not OK')).toBe(false)
    expect(defaultCheckReason(validator)).toBe('Must match the required format')
  })

  test('email accepts common valid forms and rejects obvious invalid dot forms', () => {
    const validator = checks.email()

    expect(validator.validate("first.last+tag_o'reilly@example-domain.com")).toBe(true)
    expect(validator.validate('.leading-dot@example.com')).toBe(false)
    expect(validator.validate('double..dot@example.com')).toBe(false)
  })

  test('produces named check metadata compatible with core check()', () => {
    const validator = checks.maxLength(5)
    const predicate = check<Record<string, {}>, Record<string, unknown>>('email', validator)

    expect(getNamedCheckMetadata(predicate)).toEqual({
      __check: 'maxLength',
      params: { value: 5 },
    })
  })

  test('hydrates a named check from a JSON rule definition', () => {
    const validator = createNamedCheckFromRule({
      type: 'check',
      field: 'username',
      op: 'matches',
      pattern: '^[a-z]+$',
    })

    expect(validator.validate('abc')).toBe(true)
    expect(validator.validate('123')).toBe(false)
    expect(getNamedCheckMetadata(validator)).toEqual({
      __check: 'matches',
      params: { pattern: '^[a-z]+$' },
    })
  })
})
