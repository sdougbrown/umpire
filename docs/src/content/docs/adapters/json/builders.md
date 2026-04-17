---
title: 'Builders & Checks'
description: JSON-aware expression builders, portable validators, and expr.check().
---

`@umpire/json` is the JSON-aware layer on top of the pure DSL.

- Pure non-`check` expression vocabulary lives in [`@umpire/dsl`](/umpire/extensions/dsl/)
- `@umpire/json` adds `expr.check()`
- `@umpire/json` owns `namedValidators.*()`
- `@umpire/json` owns `enabledWhenExpr`, `requiresExpr`, `disablesExpr`, and `fairWhenExpr`

## Imports

```ts
import { expr as dslExpr, compileExpr } from '@umpire/dsl'
import {
  expr,
  namedValidators,
  enabledWhenExpr,
  requiresExpr,
  disablesExpr,
  fairWhenExpr,
  requiresJson,
  anyOfJson,
  eitherOfJson,
} from '@umpire/json'

const pureWhen = dslExpr.and(
  dslExpr.present('country'),
  dslExpr.gt('total', 100),
)

const predicate = compileExpr(pureWhen, {
  fieldNames: new Set(['country', 'total']),
})
```

## `expr.check(field, validator)`

`expr.check()` is a JSON-only expression op used when a rule depends on another field passing a portable validator.

```ts
enabledWhenExpr('submit', expr.check('email', namedValidators.email()), {
  reason: 'Enter a valid email address first',
})
```

## Portable validator helpers

Use `namedValidators.*()` when checks must round-trip through JSON:

- `email`, `url`, `matches`
- `minLength`, `maxLength`
- `min`, `max`, `range`, `integer`

## JSON-aware builders

- `enabledWhenExpr(field, when, options?)`
- `requiresExpr(field, when, options?)`
- `disablesExpr(when, targets, options?)`
- `fairWhenExpr(field, when, options?)`
- `requiresJson(field, ...dependencies)`
- `anyOfJson(...rules)`
- `eitherOfJson(group, branches)`

These return normal core rules with attached JSON metadata so `toJson()` can round-trip them.

## See also

- [`@umpire/json` overview](/umpire/adapters/json/)
- [`@umpire/dsl`](/umpire/extensions/dsl/)
