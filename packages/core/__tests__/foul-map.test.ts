import type { Foul } from '../src/types.js'
import { foulMap } from '../src/index.js'

type TestFields = {
  email: {}
  plan: {}
  notes: {}
}

describe('foulMap', () => {
  test('returns an empty object for an empty list', () => {
    expect(foulMap<TestFields>([])).toEqual({})
  })

  test('indexes a single foul by field', () => {
    const fouls: Foul<TestFields>[] = [
      {
        field: 'email',
        reason: 'required',
        suggestedValue: undefined,
      },
    ]

    expect(foulMap(fouls)).toEqual({
      email: fouls[0],
    })
  })

  test('indexes multiple fouls by field', () => {
    const fouls: Foul<TestFields>[] = [
      {
        field: 'email',
        reason: 'required',
        suggestedValue: undefined,
      },
      {
        field: 'plan',
        reason: 'plan unavailable',
        suggestedValue: 'basic',
      },
      {
        field: 'notes',
        reason: 'disabled',
        suggestedValue: '',
      },
    ]

    expect(foulMap(fouls)).toEqual({
      email: fouls[0],
      plan: fouls[1],
      notes: fouls[2],
    })
  })

  test('keeps the last foul when fields are duplicated', () => {
    const fouls: Foul<TestFields>[] = [
      {
        field: 'plan',
        reason: 'old reason',
        suggestedValue: 'pro',
      },
      {
        field: 'plan',
        reason: 'new reason',
        suggestedValue: 'basic',
      },
    ]

    expect(foulMap(fouls)).toEqual({
      plan: fouls[1],
    })
  })
})
