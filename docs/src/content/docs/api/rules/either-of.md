---
title: eitherOf()
description: Named OR paths built from ANDed rule groups.
---

Use `eitherOf()` when a field can unlock through one of several named paths, and each path has multiple rules that must all pass together.

Unlike [`oneOf()`](/umpire/api/rules/one-of/), `eitherOf()` does not disable sibling branches and does not resolve a single active branch. Multiple branches may match at once.

## Signature

```ts
eitherOf(
  groupName,
  {
    branchA: [ruleA, ruleB],
    branchB: [ruleC],
  },
)
```

Each branch must be non-empty. All inner rules across all branches must target the same fields and share the same constraint (`enabled` or `fair`).

## Semantics

- Rules inside a branch are ANDed.
- Branches are ORed.
- If any branch passes, the outer rule passes.
- If every branch fails, inner reasons flatten in declaration order.
- Multiple branches may pass at once.

## Example

```ts
eitherOf('submitPath', {
  sso: [
    enabledWhen('submit', (_v, c) => c.sso, {
      reason: 'No SSO available for this domain',
    }),
  ],
  password: [
    enabledWhen('submit', check('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/), {
      reason: 'Enter a valid email address',
    }),
    enabledWhen('submit', ({ password }) => !!password, {
      reason: 'Enter a password',
    }),
    enabledWhen('submit', ({ confirmPassword, password }) => confirmPassword === password, {
      reason: 'Passwords must match',
    }),
  ],
  magicLink: [
    enabledWhen('submit', (_v, c) => c.magicLink === true, {
      reason: 'Magic link is not available',
    }),
  ],
})
```

## Challenge Output

`challenge()` preserves the group name and each named branch's nested inner rule results. It reports matching branches rather than resolving a single winner.

## See also

- [`anyOf()`](/umpire/api/rules/any-of/) — plain OR across inner rules
- [`oneOf()`](/umpire/api/rules/one-of/) — mutually exclusive field branches
