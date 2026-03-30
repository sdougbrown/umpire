---
title: Login With Captcha Gate
description: A context-driven example where submit availability depends on both field state and external captcha state.
---

# Login With Captcha Gate

This example shows a submit field controlled by both local field state and external context. It is a good demonstration of availability reasons aggregation.

## Full Setup

```ts
import { check, enabledWhen, umpire } from '@umpire/core'

const loginFields = {
  email: { required: true, isEmpty: (value) => !value },
  password: { required: true, isEmpty: (value) => !value },
  submit: { required: true },
}

type LoginContext = {
  captchaToken: string | null
}

const loginUmp = umpire<typeof loginFields, LoginContext>({
  fields: loginFields,
  rules: [
    enabledWhen('submit', (_values, context) => !!context.captchaToken, {
      reason: 'Complete the captcha to continue',
    }),
    enabledWhen('submit', check('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/), {
      reason: 'Enter a valid email address',
    }),
    enabledWhen('submit', ({ password }) => !!password, {
      reason: 'Enter a password',
    }),
  ],
})
```

## Step 1: No Captcha Yet

```ts
const result = loginUmp.check(
  { email: 'user@example.com', password: 'hunter2' },
  { captchaToken: null },
)
```

```ts
result.submit
// {
//   enabled: false,
//   required: false,
//   reason: 'Complete the captcha to continue',
//   reasons: ['Complete the captcha to continue'],
// }
```

The field is disabled, so `required` is suppressed even though the field definition says `required: true`.

## Step 2: Captcha Solved

```ts
const result = loginUmp.check(
  { email: 'user@example.com', password: 'hunter2' },
  { captchaToken: 'cf-turnstile-xxxx' },
)
```

Now `submit` is enabled. The external gate has been satisfied and the field checks pass.

## Step 3: Multiple Failures Aggregate

```ts
const result = loginUmp.check(
  { email: 'not-an-email', password: '' },
  { captchaToken: 'cf-turnstile-xxxx' },
)
```

```ts
result.submit
// {
//   enabled: false,
//   required: false,
//   reason: 'Enter a valid email address',
//   reasons: ['Enter a valid email address', 'Enter a password'],
// }
```

Two rules fail:

- the email regex bridge via `check()`
- the password presence predicate

Because the email rule was declared first, its message becomes the primary `reason`.

## Why Context Matters Here

The captcha token is not a field value the form owns. It comes from an external system, so it belongs in `context`.

That same pattern applies to:

- feature flags
- plan tiers
- abuse cooldowns
- permission checks
- remote configuration gates
