import type { Accessor } from 'solid-js'
import type { FieldDef, FieldValues, Umpire } from '@umpire/core'
import {
  reactiveUmp,
  type ReactiveUmpOptions,
  type ReactiveUmpire,
} from '@umpire/signals'
import { solidAdapter } from '@umpire/signals/solid'

export type FromSolidStoreOptions<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
> = {
  values: FieldValues<F>
  set<K extends keyof F & string>(name: K, value: FieldValues<F>[K]): void
  conditions?: Partial<{ [K in keyof C & string]: Accessor<C[K]> }>
}

export type SolidStoreUmpire<F extends Record<string, FieldDef>> =
  ReactiveUmpire<F>

export function fromSolidStore<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown> = Record<string, unknown>,
>(
  ump: Umpire<F, C>,
  options: FromSolidStoreOptions<F, C>,
): SolidStoreUmpire<F> {
  const fieldNames = ump.graph().nodes as Array<keyof F & string>

  const signals = {} as NonNullable<ReactiveUmpOptions<F, C>['signals']>

  for (const name of fieldNames) {
    signals[name] = {
      get: () => options.values[name] as FieldValues<F>[typeof name],
      set: (value) => options.set(name, value as FieldValues<F>[typeof name]),
    }
  }

  let conditions:
    | NonNullable<ReactiveUmpOptions<F, C>['conditions']>
    | undefined
  if (options.conditions) {
    conditions = {}
    for (const [name, accessor] of Object.entries(options.conditions)) {
      if (!accessor) {
        continue
      }
      conditions[name as keyof C & string] = {
        get: accessor as Accessor<C[keyof C & string]>,
      }
    }
  }

  return reactiveUmp(ump, solidAdapter, {
    signals,
    conditions,
  })
}
