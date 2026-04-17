---
title: '@umpire/dsl'
description: Pure expression types, builders, and compiler helpers.
---

`@umpire/dsl` is the pure expression layer:

- `Expr`
- `ExprBuilder`
- `expr`
- `compileExpr()`
- `getExprFieldRefs()`

It does not include `expr.check()` or validator specs.

## Install

```bash
yarn add @umpire/dsl
```

## Usage

```ts
import { compileExpr, expr, getExprFieldRefs, type Expr, type ExprBuilder } from '@umpire/dsl'

const when = expr.and(
  expr.present('country'),
  expr.gt('total', 100),
)

const predicate = compileExpr(when, {
  fieldNames: new Set(['country', 'total']),
})

predicate({ country: 'US', total: 150 }, {}) // true
getExprFieldRefs(when) // ['country', 'total']
```

## `Expr`

Supported ops:

- `eq`, `neq`, `gt`, `gte`, `lt`, `lte`
- `present`, `absent`, `truthy`, `falsy`
- `in`, `notIn`
- `cond`, `condEq`, `condIn`, `fieldInCond`
- `and`, `or`, `not`

## `ExprBuilder`

`ExprBuilder<F, C>` is the typed shape of `expr` for field keys `F` and condition keys `C`.

## `expr`

`expr` builds plain expression objects. Array/object payloads are cloned so mutating source arrays after construction does not mutate built expressions.

## `compileExpr(expr, options)`

Compiles an `Expr` into a predicate `(values, conditions) => boolean`.

- validates referenced fields against `options.fieldNames`
- validates condition declarations unless `allowUndeclaredConditions` is `true`
- marks `_checkField` when exactly one field is referenced

## `getExprFieldRefs(expr)`

Returns unique field names referenced by an expression.

## See also

- [`@umpire/json`](/umpire/adapters/json/) — JSON contract layer and `expr.check()`
- [JSON builders & checks](/umpire/adapters/json/builders/) — JSON-specific builders and portable validators
