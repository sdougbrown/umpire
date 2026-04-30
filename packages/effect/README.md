# @umpire/effect

Availability-aware Effect Schema validation and SubscriptionRef bridge for [@umpire/core](https://www.npmjs.com/package/@umpire/core)-powered state. Disabled fields produce no validation errors. Required/optional follows Umpire's availability map.

[Docs](https://sdougbrown.github.io/umpire/adapters/validation/effect/) · [Quick Start](https://sdougbrown.github.io/umpire/learn/)

## Install

```bash
npm install @umpire/core @umpire/effect effect
```

`effect` is a peer dependency — bring your own version (v3+).

## Usage

```ts
import { Either, Schema } from 'effect'
import { enabledWhen, umpire } from '@umpire/core'
import {
  createEffectAdapter,
  deriveErrors,
  deriveSchema,
  effectErrors,
} from '@umpire/effect'

// 1. Define availability rules
const ump = umpire({
  fields: {
    email: { required: true, isEmpty: (v) => !v },
    companyName: { required: true, isEmpty: (v) => !v },
  },
  rules: [
    enabledWhen('companyName', (_v, c) => c.plan === 'business', {
      reason: 'business plan required',
    }),
  ],
})

// 2. Define per-field Effect schemas (R = never required)
const fieldSchemas = {
  email: Schema.String.pipe(
    Schema.filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s), {
      message: () => 'Enter a valid email',
    }),
  ),
  companyName: Schema.String.pipe(
    Schema.filter((s) => s.length > 0, {
      message: () => 'Company name is required',
    }),
  ),
}

// 3. Compose at render time
const availability = ump.check(values, { plan })

const schema = deriveSchema(availability, fieldSchemas)
const result = Schema.decodeUnknownEither(schema)(values)

if (Either.isLeft(result)) {
  const errors = deriveErrors(availability, effectErrors(result.left))
  // errors.email → 'Enter a valid email' (only if email is enabled)
  // errors.companyName → undefined (disabled on personal plan)
}

// Or use the convenience adapter
const validation = createEffectAdapter({
  schemas: fieldSchemas,
})

const umpWithValidation = umpire({
  fields: {
    email: { required: true, isEmpty: (v) => !v },
    companyName: { required: true, isEmpty: (v) => !v },
  },
  rules: [
    enabledWhen('companyName', (_v, c) => c.plan === 'business', {
      reason: 'business plan required',
    }),
  ],
  validators: validation.validators,
})
```

## API

### `deriveSchema(availability, schemas, options?)`

Builds a `Schema.Struct` from the availability map:

- **Disabled fields** are excluded entirely
- **Enabled + required** fields use the base schema
- **Enabled + optional** fields get `Schema.optional()`

Pass per-field schemas with `R = never` — schemas with context dependencies are not supported.

#### `rejectFoul` option

Fields where `fair: false` hold values that were once valid but are now contextually wrong. By default these pass through with their base schema (useful on the client). On a **server**, you can reject them outright:

```ts
const schema = deriveSchema(availability, fieldSchemas, { rejectFoul: true })
```

When `rejectFoul: true`, a foul field with a present value fails with the field's `reason` as the error message. If the field is optional and absent, it passes.

### `effectErrors(parseError)`

Normalizes an Effect `ParseError` into `{ field, message }[]` pairs for use with `deriveErrors`.

### `deriveErrors(availability, errors)`

Filters normalized field errors to only include enabled fields and keeps the first message per field. Returns `Partial<Record<field, message>>`. Root-level errors (from cross-field refinements) are keyed under `'_root'`.

### `createEffectAdapter({ schemas, build?, rejectFoul? })`

Creates a convenience adapter with:

- `validators` for `umpire({ validators })`, surfacing the first field-level parse issue as `error`
- `run(availability, values)` for the full `deriveSchema() → decode → deriveErrors()` flow, returning `{ errors, normalizedErrors, result, schemaFields }`

Use `build` to add cross-field refinements:

```ts
const validation = createEffectAdapter({
  schemas: {
    password: Schema.String,
    confirmPassword: Schema.String,
  },
  build: (base) =>
    base.pipe(
      Schema.filter(
        (data) =>
          (data as Record<string, unknown>).password ===
          (data as Record<string, unknown>).confirmPassword,
        { message: () => 'Passwords do not match' },
      ),
    ),
})
```

If you need every issue or deeper control, you can use `deriveSchema()` and `Schema.decodeUnknownEither()` directly.

### `fromSubscriptionRef(ump, ref, options)`

Bridges an Effect `SubscriptionRef<S>` to the `@umpire/store` contract. It runs a background fiber to track changes and interrupts it on `destroy()`.

```ts
import { Effect, SubscriptionRef } from 'effect'
import { enabledWhen, umpire } from '@umpire/core'
import { fromSubscriptionRef } from '@umpire/effect'

const ump = umpire({
  fields: { name: {}, email: {} },
  rules: [enabledWhen('email', (_v, c: { showEmail: boolean }) => c.showEmail)],
})

const ref = Effect.runSync(SubscriptionRef.make({ showEmail: false }))

const store = fromSubscriptionRef(ump, ref, {
  select: () => ({}),
  conditions: (state) => state,
})

store.field('email').enabled // false

await Effect.runPromise(SubscriptionRef.set(ref, { showEmail: true }))
store.field('email').enabled // true

store.destroy()
```

`select` and `conditions` follow the same contract as `@umpire/store`. See [Selection](https://sdougbrown.github.io/umpire/concepts/selection/) for patterns.

### Blank strings and `isEmpty`

The generated validators follow Umpire's satisfaction semantics. By default, only `null` and `undefined` count as empty. So if a string field does not define `isEmpty`, a value like `''` is still considered satisfied and may surface `valid: false` immediately.

For form-style inputs, define an explicit empty-state rule:

```ts
import { isEmptyString, umpire } from '@umpire/core'

const validation = createEffectAdapter({
  schemas: {
    email: Schema.String.pipe(
      Schema.filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s), {
        message: () => 'Enter a valid email',
      }),
    ),
  },
})

const ump = umpire({
  fields: {
    email: { required: true, isEmpty: isEmptyString },
  },
  rules: [],
  validators: validation.validators,
})
```

That keeps blank strings out of the validation path until the field is satisfied under your chosen emptiness semantics.

## Docs

- [Effect Adapter](https://sdougbrown.github.io/umpire/adapters/validation/effect/) — full API reference
- [Validator Integrations](https://sdougbrown.github.io/umpire/adapters/validation/) — the general contract and how it extends to other libraries
- [Composing with Validation](https://sdougbrown.github.io/umpire/concepts/validation/) — patterns and boundary guide
- [Quick Start](https://sdougbrown.github.io/umpire/learn/) — learn each rule primitive
