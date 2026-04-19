import { describe, expect, test } from 'bun:test'
import { enabledWhen, umpire } from '@umpire/core'
import { preactAdapter } from '../src/adapters/preact.js'
import { reactiveUmp } from '../src/reactive.js'
import { fromStore } from '../../store/src/index.js'

function writableSignal<T>(initial: T) {
  const signal = preactAdapter.signal(initial)

  return {
    get: signal.get,
    set: signal.set,
  }
}

function createStore<S>(initialState: S) {
  let state = initialState
  const listeners = new Set<(next: S, prev: S) => void>()

  return {
    getState() {
      return state
    },
    subscribe(listener: (next: S, prev: S) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setState(next: S) {
      const prev = state
      state = next
      for (const listener of listeners) {
        listener(state, prev)
      }
    },
  }
}

describe('preact adapter', () => {
  test('wires reactiveUmp to @preact/signals-core', () => {
    const ump = umpire({
      fields: {
        useSso: { default: false },
        password: { default: '' },
        confirmPassword: { default: '' },
      },
      rules: [
        enabledWhen('confirmPassword', (values) => Boolean(values.password), {
          reason: 'Enter a password first',
        }),
        enabledWhen('password', (values) => values.useSso !== true, {
          reason: 'SSO login — no password needed',
        }),
        enabledWhen('confirmPassword', (values) => values.useSso !== true, {
          reason: 'SSO login — no password needed',
        }),
      ],
    })

    const reactive = reactiveUmp(ump, preactAdapter)

    reactive.update({
      password: 'hunter22',
      confirmPassword: 'hunter22',
    })

    expect(reactive.field('confirmPassword').enabled).toBe(true)

    reactive.set('useSso', true)

    expect(reactive.field('password').enabled).toBe(false)
    expect(reactive.field('confirmPassword').enabled).toBe(false)
    expect(reactive.fouls.map((foul) => foul.field).sort()).toEqual([
      'confirmPassword',
      'password',
    ])
  })

  test('supports store-driven updates while preserving signal-backed field reads', () => {
    const ump = umpire({
      fields: {
        password: { default: '' },
        confirmPassword: { default: '' },
      },
      rules: [
        enabledWhen('confirmPassword', (values) => Boolean(values.password), {
          reason: 'Enter a password first',
        }),
      ],
    })

    const password = writableSignal('')
    const confirmPassword = writableSignal('')

    const reactive = reactiveUmp(ump, preactAdapter, {
      signals: { password, confirmPassword },
    })

    const store = createStore({ password: '', confirmPassword: '' })
    const umpStore = fromStore(ump, store, {
      select: (state) => state,
    })

    const unsubscribe = store.subscribe((next) => {
      reactive.update(next)
    })

    expect(reactive.field('confirmPassword').enabled).toBe(false)

    store.setState({ password: 'hunter22', confirmPassword: '' })

    expect(umpStore.field('confirmPassword').enabled).toBe(true)
    expect(reactive.field('confirmPassword').enabled).toBe(true)
    expect(reactive.values.password).toBe('hunter22')

    store.setState({ password: '', confirmPassword: 'stale' })

    expect(umpStore.field('confirmPassword').enabled).toBe(false)
    expect(reactive.field('confirmPassword').enabled).toBe(false)

    unsubscribe()
    umpStore.destroy()
    reactive.dispose()
  })
})
