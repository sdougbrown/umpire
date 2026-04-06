---
title: Selection
description: How to map your store state to the flat InputValues shape Umpire expects — flat stores, nested objects, and split-slice ownership.
---

Every store adapter takes a `select` option. It is a function that receives your store's full state and returns a flat `{ [fieldName]: value }` object — one key per field in your schema.

```ts
fromStore(ump, store, {
  select: (state) => ({ ... })
})
```

This is the **only place** you translate between your store's shape and Umpire's expected shape. You write it once. Umpire calls it on every store update, not on every render.

## Why It Exists

Umpire's `check()` signature is deliberately simple:

```ts
ump.check(values, conditions)
```

`values` is just `{ [fieldName]: value }`. No nesting, no slices, no selectors. That simplicity is what makes rules easy to read — `requires('endTime', 'startTime')` means exactly what it says.

Your app's store has its own shape, shaped by your domain. `select` is the bridge that keeps both sides clean: your store stays organized the way your app needs it, and Umpire sees the flat shape its rules expect.

## Patterns

### Flat store — pass-through

When your store state is already keyed by field name:

```ts
const store = createStore(() => ({
  printer: 'dotMatrix',
  copies: '1',
  paperSize: 'letter',
  collate: false,
}))

fromStore(printerUmp, store, {
  select: (state) => state,
})
```

### Flat store with shape mismatch

When the store is flat but property names differ from your field schema:

```ts
// Store uses camelCase, schema uses shorthand
fromStore(ump, store, {
  select: (state) => ({
    qty:   state.quantity,
    color: state.colorMode,
    size:  state.paperSize,
  }),
})
```

### Nested store

When fields live inside a sub-object:

```ts
// Store: { settings: { copies, paperSize }, printer: { name } }
fromStore(printerUmp, store, {
  select: (state) => ({
    printer:   state.printer.name,
    copies:    state.settings.copies,
    paperSize: state.settings.paperSize,
    collate:   state.settings.collate,
  }),
})
```

### Split ownership (multiple slices)

When related fields live in separate, unrelated slices — the most common real-app case:

```ts
// Store: { profile: { email, displayName }, team: { size, domain }, billing: { plan } }
fromStore(accountUmp, store, {
  select: (state) => ({
    email:       state.profile.email,
    displayName: state.profile.displayName,
    teamSize:    state.team.size,
    teamDomain:  state.team.domain,
  }),
  conditions: (state) => ({
    plan: state.billing.plan,
  }),
})
```

Each section of your UI can own its slice. `select` is the single point where they're reassembled for Umpire. The sections themselves never need to know about each other.

## `select` vs `conditions`

Both are functions from store state. The distinction is in what Umpire does with the result.

**`select`** — produces the field values. Rules read these when evaluating availability. When a field's value changes, Umpire may detect a transition (a foul) and recommend a reset.

**`conditions`** — produces external context that rules can read but that isn't a field itself. Plan tier, user role, feature flags, locale — things that affect availability but that Umpire doesn't track, reset, or report fouls on.

```ts
enabledWhen('teamSize', (_values, conditions) => conditions.plan === 'team')
```

`plan` comes from `conditions`, not from the field values. It has no default, no isEmpty check, no foul detection. It's purely read-only context.

## Performance

`select` is called by the store adapter, not by your UI. It runs once per store update regardless of how many components are subscribed. The result is cached — `field()` and `getAvailability()` read from that cache during render.
