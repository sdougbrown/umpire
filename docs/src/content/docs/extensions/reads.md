---
title: '@umpire/reads'
description: Declare named derived values alongside your rules, with dependency tracking and full challenge() trace support.
---

`@umpire/reads` adds a declarative layer for domain-specific derived values — the computed, catalog-driven, or contextual data that sits alongside your umpire rules but doesn't belong in core. It keeps that knowledge named and shared rather than duplicated across rule predicates, render logic, and inspection consumers.

## Install

```bash
yarn add @umpire/core @umpire/reads
```

## The problem it solves

A rule like `fairWhen('motherboard', (_v, values) => socketMatches(values))` works, but it has two gaps.

First, `socketMatches` is an anonymous predicate — the rule graph knows the field, not the domain concept behind it. `challenge()` can't explain what `socketMatches` checked or which input values drove the result.

Second, the predicate is defined once and forgotten. Render logic that needs to show compatible motherboards writes its own version of the same lookup. The rule and the UI end up maintaining parallel knowledge about the same domain fact.

`@umpire/reads` solves both: you declare the derivation once with a name, use it in rules via `fairWhenRead`/`enabledWhenRead`, and `challenge()` traces include what the read evaluated and which inputs it depended on.

## `createReads(resolvers)`

Creates a read table from a map of named resolver functions.

```ts
import { createReads } from '@umpire/reads'

const pcReads = createReads({
  selectedCpu: ({ input }) => cpuById[input.cpu],
  selectedBoard: ({ input }) => boardById[input.motherboard],
  motherboardFair: ({ read }) => {
    const cpu = read('selectedCpu')
    const board = read('selectedBoard')
    return !board || !!(cpu && board.socket === cpu.socket)
  },
  compatibleBoards: ({ read }) => {
    const cpu = read('selectedCpu')
    return cpu ? boards.filter((b) => b.socket === cpu.socket) : []
  },
})
```

Each resolver receives a context object:

- `input` — the input object passed to `resolve()` or `inspect()`. Field accesses are tracked automatically via Proxy, so dependency information is captured without annotation.
- `read(key)` — resolves another read by name, with caching. Each read is computed at most once per evaluation. Reads that call other reads have their dependencies tracked too.

The table returned by `createReads` exposes:

```ts
pcReads.resolve(input)         // → all reads computed at once
pcReads.inspect(input)         // → values + dependency graph + bridges
pcReads.motherboardFair(input) // → individual read, shorthand for resolve().motherboardFair
```

Circular dependencies throw with a message naming the cycle.

## `fairWhenRead` and `enabledWhenRead`

Rule factories that wire a read directly into `fairWhen` or `enabledWhen`, and register the connection so it appears in `inspect()` and `challenge()` traces.

```ts
import { fairWhenRead, enabledWhenRead } from '@umpire/reads'
import { umpire, requires } from '@umpire/core'

const pcUmp = umpire({
  fields: pcFields,
  rules: [
    requires('motherboard', 'cpu'),
    fairWhenRead('motherboard', 'motherboardFair', pcReads, {
      reason: 'Motherboard socket does not match the selected CPU',
    }),
  ],
})
```

The third argument is the read table. The second is the key of a boolean read. `fairWhenRead` generates a `fairWhen` rule backed by that read, and records the connection as a bridge on the table.

### `inputType`

By default, reads receive field values as input. Pass `inputType: ReadInputType.CONDITIONS` when the read should evaluate against conditions instead:

```ts
import { ReadInputType } from '@umpire/reads'

const hintReads = createReads({
  canPromptSwitchCpu: ({ input }) =>
    input.hasRamSelection && input.cpuBrand === 'intel',
})

const hintUmp = umpire({
  fields: hintFields,
  rules: [
    enabledWhenRead('promptSwitchCpu', 'canPromptSwitchCpu', hintReads, {
      inputType: ReadInputType.CONDITIONS,
      reason: 'Complete steps 1–3 with Intel first',
    }),
  ],
})
```

### `selectInput`

For full control over the input mapping, provide `selectInput` instead of `inputType`:

```ts
fairWhenRead('field', 'readKey', table, {
  selectInput: (values, conditions) => ({
    brand: values.cpu,
    socket: conditions.targetSocket,
  }),
})
```

`selectInput` takes precedence over `inputType` when both are present.

## Inspection

`inspect()` returns a full picture of the read table for a given input — values, per-node dependency metadata, the dependency graph, and any rule bridges registered via `fairWhenRead`/`enabledWhenRead`.

```ts
const inspection = pcReads.inspect({ cpu: 'intel-i7', motherboard: 'asus-z790' })

inspection.values.motherboardFair          // true
inspection.nodes.motherboardFair
// {
//   id: 'motherboardFair',
//   value: true,
//   dependsOnReads: ['selectedCpu', 'selectedBoard'],
//   dependsOnFields: [],
// }

inspection.graph.edges
// [
//   { from: 'cpu',           to: 'selectedCpu',     type: 'field' },
//   { from: 'motherboard',   to: 'selectedBoard',   type: 'field' },
//   { from: 'selectedCpu',   to: 'motherboardFair', type: 'read' },
//   { from: 'selectedBoard', to: 'motherboardFair', type: 'read' },
//   { from: 'motherboardFair', to: 'motherboard',   type: 'bridge' },
// ]
```

`bridge` edges connect a read to the umpire field that depends on it through a `fairWhenRead` or `enabledWhenRead` rule. This is how the full dependency path from a field value through a derived read to an umpire field becomes visible in one graph.

## `challenge()` traces

When `fairWhenRead` or `enabledWhenRead` registers a rule, it attaches a trace to the generated rule. When `ump.challenge()` runs with `includeChallenge: true`, the trace for any read-backed rule includes:

- the read key
- the value it returned
- which fields and reads it depended on

This means `challenge()` can explain not just that a `fairWhen` rule failed, but why the read that backed it returned false — which catalog entry didn't match, which upstream read was missing.

## Composing with `scorecard()`

Reads and `scorecard()` are independent — `scorecard()` knows nothing about reads — but they compose naturally. Resolve your reads first, then pass relevant values to `scorecard()` alongside the snapshot:

```ts
const readValues = pcReads.resolve(snapshot.values)

const card = ump.scorecard(snapshot, { before })
// use card.transition.cascadingFields alongside readValues.compatibleBoards
// to power a reset banner that knows which options are now available
```

For a full composition example including the coach layer, see the [PC Builder](/examples/pc-builder/) example.

## See also

- [`ump.scorecard()`](/api/scorecard/) — structural field and transition inspection
- [`fairWhen()`](/api/rules/fair-when/) — the core rule that `fairWhenRead` builds on
- [PC Builder](/examples/pc-builder/) — full working example of `createReads`, `fairWhenRead`, and the coach layer together
