import {
  isEmptyArray,
  isEmptyObject,
  isEmptyPresent,
  isEmptyString,
} from '../src/emptiness.js'
import { umpire } from '../src/umpire.js'

describe('check() field status satisfied', () => {
  test('reflects configured isEmpty strategies', () => {
    const ump = umpire({
      fields: {
        presentField: { isEmpty: isEmptyPresent },
        stringField: { isEmpty: isEmptyString },
        arrayField: { isEmpty: isEmptyArray },
        objectField: { isEmpty: isEmptyObject },
        numberField: {
          isEmpty: (value) => typeof value !== 'number' || Number.isNaN(value),
        },
        booleanField: { isEmpty: (value) => typeof value !== 'boolean' },
      },
      rules: [],
    })

    const unsatisfied = ump.check({
      presentField: undefined,
      stringField: '',
      arrayField: [],
      objectField: {},
      numberField: NaN,
      booleanField: undefined,
    })
    const satisfied = ump.check({
      presentField: 0,
      stringField: 'x',
      arrayField: ['x'],
      objectField: { id: 1 },
      numberField: 42,
      booleanField: false,
    })

    expect(unsatisfied.presentField.satisfied).toBe(false)
    expect(unsatisfied.stringField.satisfied).toBe(false)
    expect(unsatisfied.arrayField.satisfied).toBe(false)
    expect(unsatisfied.objectField.satisfied).toBe(false)
    expect(unsatisfied.numberField.satisfied).toBe(false)
    expect(unsatisfied.booleanField.satisfied).toBe(false)

    expect(satisfied.presentField.satisfied).toBe(true)
    expect(satisfied.stringField.satisfied).toBe(true)
    expect(satisfied.arrayField.satisfied).toBe(true)
    expect(satisfied.objectField.satisfied).toBe(true)
    expect(satisfied.numberField.satisfied).toBe(true)
    expect(satisfied.booleanField.satisfied).toBe(true)
  })
})
