---
title: '@umpire/json'
description: The portable authoring layer for Umpire models that need to survive across runtimes and round-trip through a language-neutral JSON contract.
---

`@umpire/core` is the TypeScript evaluation engine. `@umpire/json` is the contract layer on top of it.

It defines what can be expressed in a language-neutral schema, serializes TypeScript configs into that schema, and parses schemas back into running Umpire instances. If you need the same Umpire model in a server-rendered UI, a Node backend, or a future runtime port, this is the package that makes that possible.

## Install

```bash
yarn add @umpire/core @umpire/json
```

## Safe parsing from unknown JSON

Use `fromJsonSafe(raw)` when your schema comes from user input, local storage, or any other untrusted source. It never throws — you get either hydrated config or errors:

```ts
import { fromJsonSafe } from '@umpire/json'

const result = fromJsonSafe(raw)

if (!result.ok) {
  console.error(result.errors)
  return
}

const { schema, fields, rules, validators } = result
```

## `fromJson(schema)`

`fromJson()` parses a trusted `UmpireJsonSchema` and returns `{ fields, rules, validators }` you can pass straight into `umpire()`:

```ts
import { umpire } from '@umpire/core'
import { fromJson } from '@umpire/json'

const { fields, rules, validators } = fromJson(schema)

const ump = umpire({ fields, rules, validators })
```

The result is composable. Hydrate most of a form from JSON and add a few hand-written rules for app-specific logic in the same `umpire()` call — the two sets coexist without conflict.

## `toJson({ fields, rules, validators, conditions })`

`toJson()` walks a TypeScript config and writes back the parts that fit the portable contract:

```ts
import { toJson } from '@umpire/json'

const json = toJson({ fields, rules, validators, conditions })
```

Three tiers of output:

- **Hydrated rules** (from `fromJson()`) round-trip exactly. Their original JSON definition is preserved and written back verbatim.
- **Hydrated validators** (from `fromJson()`) round-trip exactly. Their original JSON definition is preserved and written back verbatim.
- **Portable hand-written rules** — rules built with `namedValidators.*()`, `expr.*`, and the portable builders — are serialized when they map cleanly to the contract.
- **Portable hand-written validators** — validators built from `namedValidators.*()` — are serialized when they map cleanly to the contract.
- **Everything else** lands in `excluded`, not dropped silently.

When the config started from a `fromJson()` parse, previously declared `conditions` and `excluded` entries carry forward too. If the current runtime can now serialize something that was previously excluded, `toJson()` replaces the old entry instead of duplicating it.

## Portable validator helpers

`namedValidators.*()` are portable validator helpers that carry stable metadata across the JSON boundary:

```ts
import { check, enabledWhen } from '@umpire/core'
import { namedValidators } from '@umpire/json'

enabledWhen('submit', check('email', namedValidators.email()), {
  reason: 'Enter a valid email address',
})
```

Plain functions, regexes, Zod schemas, and Yup schemas all work with `check()`. The difference is that `namedValidators.*()` helpers know how to serialize themselves — `toJson()` can write them out and `fromJson()` can rebuild them exactly. Plain validators land in `excluded`.

Built-in portable validators in `version: 1`:

- `namedValidators.email()` — practical email syntax
- `namedValidators.url()` — absolute URL with a scheme
- `namedValidators.matches(pattern)` — regex from a serializable pattern string
- `namedValidators.minLength(n)` — string or array length at least `n`
- `namedValidators.maxLength(n)` — string or array length at most `n`
- `namedValidators.min(n)` — number at least `n`
- `namedValidators.max(n)` — number at most `n`
- `namedValidators.range(min, max)` — number within an inclusive range
- `namedValidators.integer()` — number must be an integer

The surrounding rule owns the reason string — you can pair any portable check with your own product copy.

## Portable validators

Top-level `validators` are the portable field-local validation surface. They attach to the matching field and feed Umpire's `valid` / `error` metadata directly:

```json
{
  "validators": {
    "email": { "op": "email", "error": "Enter a valid email address" }
  }
}
```

At runtime, `fromJson()` turns these into `umpire({ validators })` entries. The field stays structurally enabled or disabled according to rules; the validator only answers whether the current satisfied value is well-formed.

## Two check shapes

In `@umpire/core`, `check()` is already doing two things depending on context: it's a predicate factory when used inside `enabledWhen()` or `requires()`, and older configs may still use it as a standalone structural constraint. `@umpire/json` now keeps field-local validation separate with `validators`, but preserves the older `check` rule shape for compatibility.

**Top-level `"check"`** is the legacy standalone structural form. It still parses for compatibility, but it remains a fairness rule rather than validator metadata:

```json
{ "type": "check", "field": "email", "op": "email" }
```

**`expr.check()`** is the portable predicate-source form. It appears inside a predicate expression, letting one field's availability depend on whether another field passes a portable validator:

```json
{
  "type": "enabledWhen",
  "field": "submit",
  "when": { "op": "check", "field": "email", "check": { "op": "email" } }
}
```

The modern split is:

- `validators` for field-local validation metadata
- `expr.check()` for structural predicates that depend on another field passing a portable validator
- top-level `"check"` only when you need to preserve older JSON schemas

See [@umpire/dsl](/umpire/extensions/dsl/) for the full non-`check` expression vocabulary.

## Conditions

Conditions are declared inputs that the consuming runtime provides at evaluation time:

```json
{
  "conditions": {
    "isAdmin": { "type": "boolean" },
    "validPlans": { "type": "string[]" }
  }
}
```

Use them for external state — account tier, feature flags, auth state, server-provided option sets. They're the correct home for anything the form itself doesn't own.

## `excluded`

Some rules are too app-specific to serialize safely. When `toJson()` encounters one, it records it in `excluded` rather than dropping it:

```json
{
  "excluded": [
    {
      "key": "fairWhen:motherboard",
      "type": "fairWhen",
      "field": "motherboard",
      "description": "Predicate requires runtime domain logic"
    }
  ]
}
```

`excluded` covers field-level slots too — `field:isEmpty` and `field:default` entries land here when they can't be expressed as primitive values.

`excluded.key` gives each entry a stable identity. Later serializations can replace or remove entries by key when a runtime learns to handle a previously excluded slot natively.

`excluded` is informational. No runtime evaluates it automatically. Its job is to tell the next implementation: there was logic here, and you'll need to recreate it natively.

## Portable field semantics

Field defaults stay primitive-only in the JSON contract: `string`, `number`, `boolean`, or `null`.

For `isEmpty`, the portable strategy names are:

- `'present'` — default Umpire semantics (`null` and `undefined` are empty)
- `'string'`
- `'array'`
- `'object'`
- `'number'`
- `'boolean'`

The corresponding `@umpire/core` helpers (`isEmptyString`, `isEmptyArray`, `isEmptyObject`) round-trip cleanly through these strategy names.

## Authoring for portability

If your Umpire model needs to survive a runtime boundary, write it through the JSON vocabulary rather than plain TypeScript predicates.

The portable toolkit is:

- `namedValidators.*()` for field-local value constraints
- top-level `validators` for portable field-local validation
- `expr.*` from `@umpire/dsl` for predicate expressions inside `enabledWhen`, `requires`, `disables`, and `fairWhen`
- Portable builders (`requiresJson`, `enabledWhenExpr`, `disablesExpr`, `fairWhenExpr`) for constructing rules that carry their own JSON definition from birth

Arbitrary functions, regexes, and library validators still work at runtime — they just won't serialize. `toJson()` records them in `excluded` and the next implementation has to recreate them natively.

See [@umpire/dsl](/umpire/extensions/dsl/) and [Builders & Checks](/umpire/extensions/json/builders/) for the full authoring vocabulary.

## See also

- [@umpire/dsl](/umpire/extensions/dsl/) — pure `Expr`, `expr.*`, `compileExpr`, and `getExprFieldRefs`
- [Builders & Checks](/umpire/extensions/json/builders/) — JSON-only `expr.check()`, `namedValidators`, and portable builders
- [Composing with Validation](/umpire/concepts/validation/) — where `check()` fits conceptually
- [check() helper](/umpire/api/rules/check/) — validator shapes in core
- [Config-Driven UI, With Behavior](/umpire/examples/config-driven-ui/) — live-edit a JSON schema and watch a generic renderer respond
