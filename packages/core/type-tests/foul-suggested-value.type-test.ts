import { strike, umpire } from '../src/index.js'
import type { FieldDef, Foul } from '../src/index.js'

type Fields = {
  plan: FieldDef<'free' | 'pro'>
  seats: FieldDef<number>
  notes: FieldDef<string>
}

declare const foul: Foul<Fields>

if (foul.field === 'plan') {
  const value: 'free' | 'pro' | undefined = foul.suggestedValue

  // @ts-expect-error plan suggestedValue is not a number
  const invalid: number = foul.suggestedValue
}

if (foul.field === 'seats') {
  const value: number | undefined = foul.suggestedValue

  // @ts-expect-error seats suggestedValue is not a string
  const invalid: string = foul.suggestedValue
}

if (foul.field === 'notes') {
  const value: string | undefined = foul.suggestedValue

  // @ts-expect-error notes suggestedValue is not a number
  const invalid: number = foul.suggestedValue
}

const validFoul: Foul<Fields> = {
  field: 'seats',
  reason: 'reset seats',
  suggestedValue: 5,
}

const validUndefinedFoul: Foul<Fields> = {
  field: 'notes',
  reason: 'clear notes',
  suggestedValue: undefined,
}

const typed = umpire({
  fields: {
    plan: { default: 'free' as const },
    seats: { default: 1 },
    notes: { default: '' },
  },
  rules: [],
})

const played = typed.play(
  { values: { plan: 'free', seats: 1, notes: 'hello' } },
  { values: { plan: 'free', seats: 1, notes: 'hello' } },
)

const maybePlayedFoul = played[0]
if (maybePlayedFoul && maybePlayedFoul.field === 'notes') {
  const value: string | undefined = maybePlayedFoul.suggestedValue

  // @ts-expect-error notes suggestedValue is not boolean
  const invalid: boolean = maybePlayedFoul.suggestedValue

  void value
}

const struck = strike<Fields>(
  { plan: 'free', seats: 1, notes: 'hello' },
  [{ field: 'seats', reason: 'reset seats', suggestedValue: 3 }],
)

const struckSeats: number | undefined = struck.seats

// @ts-expect-error seats foul suggestedValue must be number | undefined
strike<Fields>({}, [{ field: 'seats', reason: 'wrong type', suggestedValue: '3' }])

// @ts-expect-error seats suggestedValue must be number | undefined
const invalidFoul: Foul<Fields> = {
  field: 'seats',
  reason: 'wrong type',
  suggestedValue: '5',
}

void validFoul
void validUndefinedFoul
void invalidFoul
