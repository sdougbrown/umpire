import { describe, test, expect } from 'bun:test'
import { isEqual } from '../src/equality.js'

describe('isEqual', () => {
  test('treats null as equal only to null', () => {
    expect(isEqual(null, null)).toBe(true)
    expect(isEqual(null, undefined)).toBe(false)
  })

  test('does not treat plain objects as equal without Setoid support', () => {
    expect(isEqual({ id: 1 }, { id: 1 })).toBe(false)
  })

  test('uses the left fantasy-land equals implementation when present', () => {
    expect(
      isEqual(
        {
          'fantasy-land/equals': (other: unknown) =>
            other instanceof Date && other.getTime() === 123,
        },
        new Date(123),
      ),
    ).toBe(true)
  })

  test('returns false when the left fantasy-land equals implementation says so', () => {
    expect(
      isEqual(
        {
          'fantasy-land/equals': () => false,
        },
        { id: 1 },
      ),
    ).toBe(false)
  })

  test('falls back to Object.is when fantasy-land equals is not a function', () => {
    expect(
      isEqual({ 'fantasy-land/equals': true }, { 'fantasy-land/equals': true }),
    ).toBe(false)
  })

  test('uses the left equals implementation when present', () => {
    expect(
      isEqual(
        {
          equals: (other: unknown) =>
            other instanceof Date && other.getTime() === 123,
        },
        new Date(123),
      ),
    ).toBe(true)
  })

  test('returns false when the left equals implementation says so', () => {
    expect(
      isEqual(
        {
          equals: () => false,
        },
        { id: 1 },
      ),
    ).toBe(false)
  })

  test('falls back to Object.is when equals is not a function', () => {
    expect(isEqual({ equals: true }, { equals: true })).toBe(false)
  })

  test('falls back to Object.is semantics without Setoid support', () => {
    const shared = { id: 1 }

    expect(isEqual(shared, shared)).toBe(true)
    expect(isEqual(NaN, NaN)).toBe(true)
    expect(isEqual(-0, 0)).toBe(false)
  })

  test('ignores right-side setoid support when the left side is not a setoid', () => {
    expect(
      isEqual(
        { id: 1 },
        {
          'fantasy-land/equals': () => true,
          id: 1,
        },
      ),
    ).toBe(false)
  })
})
