# 🛂 Umpire

> Rule the form. Play the field.

Umpire is a declarative field-availability engine. Define fields, declare rules between them, and Umpire tells you which fields are in play — and which stale values just fell out. It answers a structural question, not a validation question: given the current values and conditions, what should be enabled right now?

Forms are the most common use case, but Umpire works anywhere state fits a plain object with interdependent options — game boards, config panels, pricing calculators, permission matrices. If it has fields and rules, Umpire can call the game.

[![CI](https://github.com/umpire-tools/umpire/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/umpire-tools/umpire/actions/workflows/ci.yml)
[![Coverage](https://coveralls.io/repos/github/umpire-tools/umpire/badge.svg?branch=main)](https://coveralls.io/github/umpire-tools/umpire?branch=main)
[![npm](https://img.shields.io/npm/v/@umpire/core?label=%40umpire%2Fcore)](https://www.npmjs.com/package/@umpire/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Docs](https://umpire.tools/) • [GitHub](https://github.com/umpire-tools/umpire)

## Quick Example

```ts
import { requires, umpire } from '@umpire/core'

const ump = umpire({
  fields: {
    password: {},
    confirmPassword: {},
  },
  rules: [requires('confirmPassword', 'password')],
})

ump.check({ password: '', confirmPassword: '' }).confirmPassword
// { enabled: false, satisfied: false, fair: true, required: false, reason: 'requires password', reasons: ['requires password'] }

ump.check({ password: 'hunter2', confirmPassword: '' }).confirmPassword
// { enabled: true, satisfied: false, fair: true, required: false, reason: null, reasons: [] }
```

For a larger example with conditions, plan-gated fields, and `play()` transitions, see the [Signup example](https://sdougbrown.github.io/umpire/examples/signup/) in the docs.

## Packages

| Package                                                         | Purpose                                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`@umpire/core`](./packages/core/README.md)                     | Pure logic engine with zero runtime dependencies                              |
| [`@umpire/dsl`](./packages/dsl/README.md)                       | Pure expression DSL (`expr.*`, `compileExpr`, `getExprFieldRefs`)             |
| [`@umpire/react`](./packages/react/README.md)                   | `useUmpire()` hook for React                                                  |
| [`@umpire/solid`](./packages/solid/README.md)                   | `useUmpire()` hook for Solid                                                  |
| [`@umpire/signals`](./packages/signals/README.md)               | Signal adapter via `SignalProtocol` (Jotai, Preact, Alien Signals, TC39)      |
| [`@umpire/store`](./packages/store/README.md)                   | Generic store adapter — bring your own `getState()` + `subscribe(next, prev)` |
| [`@umpire/zustand`](./packages/zustand/README.md)               | Zustand adapter (satisfies the store contract natively)                       |
| [`@umpire/redux`](./packages/redux/README.md)                   | Redux / Redux Toolkit adapter                                                 |
| [`@umpire/tanstack-store`](./packages/tanstack-store/README.md) | TanStack Store adapter                                                        |
| [`@umpire/pinia`](./packages/pinia/README.md)                   | Pinia adapter                                                                 |
| [`@umpire/vuex`](./packages/vuex/README.md)                     | Vuex 4 adapter                                                                |
| [`@umpire/zod`](./packages/zod/README.md)                       | Availability-aware Zod schemas — disabled fields produce no errors            |
| [`@umpire/reads`](./packages/reads/README.md)                   | Derived read tables and read-backed rule bridges                              |
| [`@umpire/write`](./packages/write/README.md)                   | Create/patch write-policy checks against Umpire availability                  |
| [`@umpire/drizzle`](./packages/drizzle/README.md)               | Drizzle table hydration for Umpire fields plus write-policy re-exports        |
| [`@umpire/testing`](./packages/testing/README.md)               | Invariant probes for rule configurations                                      |
| [`@umpire/devtools`](./packages/devtools/README.md)             | In-app inspector panel — scorecard, traces, foul log, graph view              |

## Why Umpire?

- Pure logic, zero dependencies.
- Declarative rules: `requires`, `disables`, `enabledWhen`, `fairWhen`, `oneOf`.
- Recommendations, not mutations: `play()` suggests resets, you decide when to apply them.
- Adapters for React, Solid, Zustand, Redux, TanStack Store, Pinia, Vuex, and signals.
- Debuggable: `challenge()` traces why any field was ruled out, `@umpire/devtools` surfaces it visually.

## Install

```bash
npm install @umpire/core
```

Published packages do not require Bun to consume.

## Contributing

Local repo work expects:

- Node 24+
- Yarn 4
- Bun 1.2+

`yarn test` and `yarn test:coverage` use Bun under the hood, so those commands will fail if Bun is not installed.

## Docs

Full docs, concepts, and examples live at https://umpire.tools/

## Droid-Friendly

Each published package ships a tight `AGENTS.md` file for cross-agent discoverability, with `.claude/rules/*` included as a Claude-specific compatibility surface. In this repo, `AGENTS.md` is canonical and `CLAUDE.md` plus `.cursor/rules/` are compatibility symlinks.

## Status

Stable — v1.0.0

## License

MIT
