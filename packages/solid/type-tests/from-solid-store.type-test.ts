import { enabledWhen, umpire } from '@umpire/core'
import type { FieldDef, FieldValues } from '@umpire/core'
import { fromSolidStore } from '../src/fromSolidStore.js'

type Fields = {
  count: FieldDef<number>
  active: FieldDef<boolean>
  label: FieldDef<string>
}

type Conditions = {
  tier: 'free' | 'pro'
  stage: number
}

const typedUmp = umpire<Fields, Conditions>({
  fields: {
    count: { default: 0 },
    active: { default: true },
    label: { default: '' },
  },
  rules: [
    enabledWhen(
      'label',
      (_values, conditions) =>
        conditions.tier === 'pro' && conditions.stage > 0,
    ),
  ],
})

const values: FieldValues<Fields> = {
  count: 1,
  active: false,
  label: 'ready',
}

const form = fromSolidStore(typedUmp, {
  values,
  set(name, value) {
    values[name] = value
  },
  conditions: {
    tier: () => 'pro',
    stage: () => 1,
  },
})

form.set('count', 2)
form.set('active', true)
form.set('label', 'updated')

// @ts-expect-error count expects number
form.set('count', '2')

// @ts-expect-error unknown field should be rejected
form.set('missing', 1)

form.update({
  active: false,
  label: 'next',
})

// @ts-expect-error active expects boolean
form.update({ active: 'false' })

const count: number | undefined = form.values.count
const active: boolean | undefined = form.values.active
const label: string | undefined = form.values.label

// @ts-expect-error count is not string
const invalidCount: string = form.values.count

fromSolidStore(typedUmp, {
  values,
  set(name, value) {
    values[name] = value
  },
  conditions: {
    tier: () => 'pro',
    stage: () => 1,
    // @ts-expect-error unknown condition key should be rejected
    missing: () => 'x',
  },
})

void count
void active
void label
void invalidCount
