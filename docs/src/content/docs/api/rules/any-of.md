---
title: anyOf()
description: Pass if any inner rule passes — OR logic for availability.
---

Multiple rules targeting the same field are ANDed by default. Wrap them in `anyOf()` when any one successful path should unlock the target.

## Signature

```ts
anyOf(ruleA, ruleB, ruleC)
```

All inner rules must target the same fields, or creation throws.

## Example

```ts
anyOf(
  enabledWhen('submit', ({ password }) => !!password, {
    reason: 'Enter a password',
  }),
  enabledWhen('submit', (_values, conditions) => conditions.bypass === true, {
    reason: 'Bypass flag missing',
  }),
)
```

Either a password or a bypass flag unlocks submit. When both fail, all inner reasons are collected in `reasons`.

## See also

- [Quick Start: anyOf](/umpire/learn/#anyof) — interactive demo
- [`enabledWhen()`](/umpire/api/rules/enabled-when/) — the most common inner rule for `anyOf`
