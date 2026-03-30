---
title: Signup Form Walkthrough
description: A complete signup form example showing availability checks and reset recommendations.
---

# Signup Form Walkthrough

This example stays deliberately small, but it shows the core shape of Umpire: presence-based dependencies, context-driven availability, and reset recommendations when context changes.

## Full Setup

```ts
import { enabledWhen, requires, umpire } from '@umpire/core'

const signupFields = {
  email: { required: true, isEmpty: (value) => !value },
  password: { required: true, isEmpty: (value) => !value },
  confirmPassword: { required: true, isEmpty: (value) => !value },
  referralCode: {},
  companyName: {},
  companySize: {},
}

type SignupContext = {
  plan: 'personal' | 'business'
}

const signupUmp = umpire<typeof signupFields, SignupContext>({
  fields: signupFields,
  rules: [
    requires('confirmPassword', 'password'),
    enabledWhen('companyName', (_values, context) => context.plan === 'business', {
      reason: 'business plan required',
    }),
    enabledWhen('companySize', (_values, context) => context.plan === 'business', {
      reason: 'business plan required',
    }),
    requires('companySize', 'companyName'),
  ],
})
```

## Step 1: Personal Plan

```ts
const result = signupUmp.check(
  { email: 'alex@example.com', password: 'hunter2' },
  { plan: 'personal' },
)
```

Key results:

- `confirmPassword` is enabled because `password` is present.
- `companyName` is disabled with reason `"business plan required"`.
- `companySize` is also disabled for the same reason.

## Step 2: Business Plan Without Company Name

```ts
const result = signupUmp.check(
  { email: 'alex@example.com', password: 'hunter2' },
  { plan: 'business' },
)
```

Key results:

- `companyName` is now enabled.
- `companySize` is still disabled with reason `"requires companyName"`.

That is the important layering:

- `enabledWhen()` opens the company fields for the business plan.
- `requires()` then keeps `companySize` gated on actual company name presence.

## Step 3: Confirm Password Gate

```ts
const result = signupUmp.check(
  { email: 'alex@example.com' },
  { plan: 'personal' },
)
```

Now `confirmPassword` becomes unavailable:

```ts
result.confirmPassword
// {
//   enabled: false,
//   required: false,
//   reason: 'requires password',
//   reasons: ['requires password'],
// }
```

Because the field is disabled, `required` is suppressed to `false`.

## Step 4: Switching Plans And Calling `flag()`

```ts
const penalties = signupUmp.flag(
  {
    values: {
      email: 'alex@example.com',
      password: 'hunter2',
      companyName: 'Acme',
      companySize: '50',
    },
    context: { plan: 'business' },
  },
  {
    values: {
      email: 'alex@example.com',
      password: 'hunter2',
      companyName: 'Acme',
      companySize: '50',
    },
    context: { plan: 'personal' },
  },
)
```

```ts
penalties
// [
//   {
//     field: 'companyName',
//     reason: 'business plan required',
//     suggestedValue: undefined,
//   },
//   {
//     field: 'companySize',
//     reason: 'business plan required',
//     suggestedValue: undefined,
//   },
// ]
```

Only context changed. That is enough for `flag()` because it evaluates before and after snapshots, not just value diffs.

## What This Example Does Not Cover

Umpire does not validate:

- that the email is well-formed
- that the password is strong enough
- that `confirmPassword` matches `password`

Those are value-correctness concerns, not availability concerns.
