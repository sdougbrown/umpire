import { describe, expect, test } from 'bun:test'
import { enabledWhen, umpire, type Foul } from '@umpire/core'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — solid-js types are available at runtime in this workspace
import { createRoot } from 'solid-js'
import { solidAdapter } from '../src/adapters/solid.js'
import { reactiveUmp } from '../src/reactive.js'

describe('solid adapter', () => {
  test('tracks fouls inside a root and stays safe after dispose', async () => {
    const fields = {
      useSso: { default: false },
      password: { default: '' },
      confirmPassword: { default: '' },
    }

    const ump = umpire({
      fields,
      rules: [
        enabledWhen('password', (values) => values.useSso !== true),
        enabledWhen('confirmPassword', (values) => values.useSso !== true),
        enabledWhen('confirmPassword', (values) => Boolean(values.password), {
          reason: 'Enter a password first',
        }),
      ],
    })

    let reactive
    let disposeRoot = () => {}

    createRoot((dispose) => {
      disposeRoot = dispose
      reactive = reactiveUmp(ump, solidAdapter)
    })

    reactive!.update({ password: 'hunter22', confirmPassword: 'hunter22' })
    reactive!.set('useSso', true)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(reactive!.field('password').enabled).toBe(false)
    expect(reactive!.field('confirmPassword').enabled).toBe(false)
    expect(reactive!.foul('password')).toEqual({
      field: 'password',
      reason: 'condition not met',
      suggestedValue: '',
    })
    expect(
      reactive!.fouls.map((foul: Foul<typeof fields>) => foul.field).sort(),
    ).toEqual(['password'])

    reactive!.dispose()
    disposeRoot()
    expect(() => reactive!.set('useSso', false)).not.toThrow()
  })
})
