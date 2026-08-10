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
