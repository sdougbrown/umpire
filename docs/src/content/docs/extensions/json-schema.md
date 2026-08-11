---
title: '@umpire/json-schema'
description: JSON Schema composition profile — pair Umpire field availability with JSON Schema structural validation while keeping both as independent authorities.
---

`@umpire/json-schema` is an optional package that pairs Umpire's field-availability evaluation with JSON Schema structural validation. Instead of translating one authority into the other, a **profile document** carries both and the results stay separate: `check()` returns Umpire availability, `validateStructure()` returns JSON Schema structural issues, and `evaluate()` returns both.

This is for object-shaped values with interdependent options that also need portable, code-generatable structural validation — without turning Umpire's evaluator into a general schema engine.

## Install

```bash
yarn add @umpire/json-schema
```

## Quick start

Compile a canonical profile document:

```ts
import { compileProfile } from '@umpire/json-schema'

const compiled = compileProfile({
  $schema:
    'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
  profileVersion: 1,
  valueSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      count: { type: 'integer', minimum: 0 },
      action: {
        oneOf: [
          {
            type: 'object',
            properties: { kind: { const: 'manual' }, note: { type: 'string' } },
            required: ['kind', 'note'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: { kind: { const: 'run' }, command: { type: 'string' } },
            required: ['kind', 'command'],
            additionalProperties: false,
          },
        ],
      },
    },
    additionalProperties: false,
  },
  umpire: {
    version: 1,
    fields: { name: { isEmpty: 'string' }, count: { isEmpty: 'number' }, action: { isEmpty: 'present' } },
    rules: [],
  },
})

if (compiled.ok) {
  // Umpire availability
  const availability = compiled.profile.check({ name: 'hello' })
  // JSON Schema structural validation
  const structure = compiled.profile.validateStructure({ name: 'hello' })
  // Both together
  const result = compiled.profile.evaluate({ name: 'hello' })
}
```

Alternatively, pass the two authorities separately with `compileSchemas({ valueSchema, umpire })`; the package wraps them in a canonical profile v1 document internally.

## Two independent authorities

| | `check()` / `evaluate().availability` | `validateStructure()` / `evaluate().structure` |
| --- | --- | --- |
| Owns | field availability, satisfaction, requiredness, fairness, reasons, transitions | structural correctness: types, objects, arrays, enums, constants, bounds, strict properties, tagged unions |
| Output | `Record<string, FieldStatus>` | `{ valid, issues[] }` |

Structural issues use `code` values that are the offending JSON Schema keyword (`type`, `required`, `additionalProperties`, `minItems`, `maxItems`, `minLength`, `maxLength`, `minimum`, `maximum`, `enum`, `const`) or the profile runtime code `discriminator` for tagged unions. Structural results never overwrite `FieldStatus.valid` or `error`.

## Tagged unions

A `oneOf` whose branches share one required discriminator property with a distinct string `const` is treated as a tagged union. A missing discriminator yields `required` at the discriminator path; an unknown discriminator value yields `discriminator` there.

## UI filtering

`filterStructuralIssues(availability, issues)` drops structural issues whose root field is disabled in the current availability map, for consumers that want to hide noise behind collapsed sections. It never filters by default.

## Retained constraints

- `@umpire/core` and `@umpire/json` have no JSON Schema dependency; this package layer adds AJV 2020-12.
- Unsupported JSON Schema keywords fail profile compilation instead of degrading silently.
