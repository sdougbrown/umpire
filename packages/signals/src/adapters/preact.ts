import type { SignalProtocol } from '../protocol.js'

// @preact/signals-core is an optional peer dependency.
// This file only compiles/runs when the consumer has it installed.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — types unavailable unless @preact/signals-core is installed
import { signal, computed, effect, batch } from '@preact/signals-core'

export const preactAdapter: SignalProtocol = {
  signal(initial) {
    const s = signal(initial)
    return {
      get: () => s.value,
      set: (v: unknown) => {
        s.value = v
      },
    }
  },
  computed(fn) {
    const c = computed(fn)
    return { get: () => c.value }
  },
  effect(fn) {
    return effect(fn)
  },
  batch,
}
