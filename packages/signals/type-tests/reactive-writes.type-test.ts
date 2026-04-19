import { enabledWhen, umpire } from '@umpire/core'
import type { SignalProtocol } from '../src/protocol.js'
import { reactiveUmp } from '../src/reactive.js'

const adapter: SignalProtocol = {
  signal<T>(initial: T) {
    let value = initial
    return {
      get() {
        return value
      },
      set(next: T) {
        value = next
      },
    }
  },
  computed<T>(fn: () => T) {
    return {
      get() {
        return fn()
      },
    }
  },
}

const form = reactiveUmp(umpire({
  fields: {
    count: { default: 0 },
    label: { default: '' },
    enabled: { default: true },
  },
  rules: [],
}), adapter)

const conditionedUmp = umpire<
  {
    count: { default: number }
    label: { default: string }
    enabled: { default: boolean }
  },
  { plan: 'free' | 'pro'; stage: number }
>({
  fields: {
    count: { default: 0 },
    label: { default: '' },
    enabled: { default: true },
  },
  rules: [
    enabledWhen('enabled', (_values, conditions) => conditions.plan === 'pro' && conditions.stage > 0),
  ],
})

const optionsForm = reactiveUmp(
  conditionedUmp,
  adapter,
  {
    signals: {
      count: {
        get: () => 1,
        set: (_next) => {},
      },
      label: {
        get: () => 'label',
        // @ts-expect-error label signal set must accept string
        set: (_next: number) => {},
      },
    },
    conditions: {
      plan: { get: () => 'free' },
      // @ts-expect-error stage condition must return number
      stage: { get: () => '1' },
    },
  },
)

void optionsForm

form.set('count', 1)
form.set('label', 'hello')
form.set('enabled', false)

// @ts-expect-error count expects number
form.set('count', '1')

// @ts-expect-error label expects string
form.set('label', 1)

// @ts-expect-error enabled expects boolean
form.set('enabled', 'false')

// @ts-expect-error field name must be known
form.set('missing', 'value')

form.update({
  count: 2,
  label: 'updated',
})

// @ts-expect-error update count expects number
form.update({ count: '2' })

// @ts-expect-error update enabled expects boolean
form.update({ enabled: 'false' })

const count: number | undefined = form.values.count
const label: string | undefined = form.values.label
const enabled: boolean | undefined = form.values.enabled

// @ts-expect-error count is not boolean
const invalidCount: boolean = form.values.count

// @ts-expect-error unknown key should not be accepted
form.update({ missing: 'x' })

// @ts-expect-error values should not expose unknown keys
const missing = form.values.missing

const maybeFoul = form.foul('count')
if (maybeFoul && maybeFoul.field === 'count') {
  const foulValue: number | undefined = maybeFoul.suggestedValue

  // @ts-expect-error count foul suggestedValue is not string
  const invalidFoulValue: string = maybeFoul.suggestedValue

  void foulValue
  void invalidFoulValue
}

const allFouls = form.fouls
const firstFoul = allFouls[0]
if (firstFoul && firstFoul.field === 'enabled') {
  const foulValue: boolean | undefined = firstFoul.suggestedValue

  // @ts-expect-error enabled foul suggestedValue is not number
  const invalidFoulValue: number = firstFoul.suggestedValue

  void foulValue
  void invalidFoulValue
}

void count
void label
void enabled
void invalidCount
void missing
