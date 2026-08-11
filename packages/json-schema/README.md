# @umpire/json-schema

**JSON Schema composition profile for Umpire.**

This optional package pairs Umpire's field-availability evaluation with JSON Schema structural validation, keeping both as independent authorities. It does not translate one into the other or merge their results.

## Install

```bash
yarn add @umpire/json-schema
```

## Quick start

```ts
import { compileProfile, compileSchemas } from '@umpire/json-schema'

const profile = compileProfile({
  $schema:
    'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
  profileVersion: 1,
  valueSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      name: { type: 'string' },
      count: { type: 'integer' },
    },
    additionalProperties: false,
  },
  umpire: {
    version: 1,
    fields: { name: {}, count: {} },
    rules: [],
  },
})

if (profile.ok) {
  // Umpire availability
  const availability = profile.profile.check({ name: 'hello' })
  // Structural validation
  const structure = profile.profile.validateStructure({ name: 'hello' })
  // Both together
  const { availability: a, structure: s } = profile.profile.evaluate({
    name: 'hello',
  })
}
```

## API

### `compileProfile(raw)`

Parse a canonical profile document, compile both authorities, and run consistency checks.

### `compileSchemas({ valueSchema, umpire })`

Accept separately-supplied JSON Schema and Umpire documents, wrap them in a canonical profile v1 document, and proceed as `compileProfile()`.

### `CompiledProfile`

- `check(values, conditions?, prev?)` — delegates to the hydrated Umpire evaluator.
- `validateStructure(values)` — runs AJV 2020-12 against raw values, returns normalized structural issues.
- `evaluate(values, conditions?, prev?)` — calls both and returns separate results.

### `filterStructuralIssues(availability, issues)`

Pure UI helper: drops structural issues whose first RFC 6901 path segment matches a known disabled Umpire field name. For example, an issue at path `/nodes/0/id` is suppressed when the `nodes` field is disabled. Root issues at path `/` are always retained.

## Authority boundaries

- Umpire evaluates field availability, satisfaction, requiredness, fairness, reasons, and transitions.
- JSON Schema validates structural correctness: types, nested objects, arrays, enums, constants, bounds, strict properties, and tagged unions.
- The two never mix.

## Summary of the public API

| Export                                                          | Kind      | Purpose                                                                            |
| --------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `compileProfile(raw)`                                           | function  | Parse and compile a canonical profile document.                                    |
| `compileSchemas({ valueSchema, umpire })`                       | function  | Compile separately-supplied authorities by wrapping them in a profile v1 document. |
| `CompiledProfile`                                               | interface | `check()`, `validateStructure()`, `evaluate()`.                                    |
| `filterStructuralIssues(availability, issues)`                  | function  | Drop structural issues whose root field is disabled.                               |
| `ProfileDocument`, `CompileProfileResult`, `StructuralIssue`, … | types     | Public typing.                                                                     |

## Structural issue contract

Structural issues carry `source` (`"json-schema"`), `code`, `path` (RFC 6901 into the instance), an optional `schemaPath`, and a human `message`. `code` is the offending JSON Schema keyword (`type`, `required`, `additionalProperties`, `minItems`, `maxItems`, `minLength`, `maxLength`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `enum`, `const`) or a profile runtime code (`discriminator`). Issues are normalized: deduplicated by `(source, code, path)`, sorted by path then code, with tagger union branch noise suppressed and same-path `type` failures suppressing value-dependent keywords.

## Tagged unions

Profile v1 unions use a `oneOf` whose branches share one required discriminator property holding a distinct string `const`. The package injects AJV's `discriminator` keyword at compile time and reports:

- a missing discriminator as `required` at the discriminator path;
- an unknown discriminator value as `discriminator` at the discriminator path.

## Conditions

Profile availability evaluation reuses base Umpire condition semantics unchanged: `conditions` is passed through to `check()`/`evaluate()` as-is, and an unsupplied condition referenced by a rule fails exactly as it does in `@umpire/json`. No new availability behavior is layered onto the profile wrapper.

## Vendored specification files

The package ships the pinned umpire-spec release under `schemas/` (the canonical profile meta-schema) and `conformance/` (the profile conformance fixtures). Keep them in sync with `node scripts/sync-umpire-spec.mjs` at the repo root; a sync test asserts the inline profile meta-schema matches the shipped file.
