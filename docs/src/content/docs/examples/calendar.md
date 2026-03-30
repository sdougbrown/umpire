---
title: Calendar Recurrence Walkthrough
description: A complex DateRange recurrence example showing disables, oneOf, and requires working together.
---

# Calendar Recurrence Walkthrough

This is the richer example from the spec. It combines structural disabling, mutually exclusive branches, and transitive dependencies.

## Full Setup

```ts
import { disables, enabledWhen, oneOf, requires, umpire } from '@umpire/core'

const recurrenceFields = {
  fromDate: {},
  toDate: {},
  fixedBetween: { default: false },
  dates: {},
  everyWeekday: {},
  everyDate: {},
  everyMonth: {},
  exceptDates: {},
  exceptBetween: {},
  everyHour: {},
  startTime: {},
  endTime: {},
  repeatEvery: {},
  duration: {},
}

const recurrenceUmp = umpire({
  fields: recurrenceFields,
  rules: [
    disables('dates', [
      'everyWeekday',
      'everyDate',
      'everyMonth',
      'everyHour',
      'startTime',
      'endTime',
      'repeatEvery',
      'exceptDates',
      'exceptBetween',
    ]),
    oneOf('subDayStrategy', {
      hourList: ['everyHour'],
      interval: ['startTime', 'endTime', 'repeatEvery'],
    }),
    requires('repeatEvery', 'startTime'),
    requires('endTime', 'startTime'),
    enabledWhen('fixedBetween', ({ fromDate, toDate }) => !!fromDate && !!toDate),
    enabledWhen('exceptDates', (values) => !!(values.everyWeekday || values.everyDate || values.everyMonth)),
    enabledWhen('exceptBetween', (values) => !!(values.everyWeekday || values.everyDate || values.everyMonth)),
  ],
})
```

## Step 1: Explicit Dates Override Patterns

```ts
let values = recurrenceUmp.init()
values = { ...values, dates: ['2026-04-01', '2026-04-05'] }

const result = recurrenceUmp.check(values)
```

Important outcomes:

- `everyWeekday`, `everyDate`, and `everyMonth` are disabled.
- `everyHour`, `startTime`, `endTime`, and `repeatEvery` are disabled.
- both exclusion fields are disabled.

The shared reason is `"overridden by dates"`.

## Step 2: Clear Dates, Switch To Pattern Recurrence

```ts
const prev = values
values = { ...values, dates: undefined, everyWeekday: [1, 3, 5] }

const result = recurrenceUmp.check(values)
```

Now:

- `dates` is enabled again.
- both sub-day strategies are available because neither branch is active yet.
- `exceptDates` and `exceptBetween` become enabled because a recurrence pattern now exists.

## Step 3: Pick The Interval Branch

```ts
const prev2 = values
values = { ...values, startTime: '09:00' }

const result = recurrenceUmp.check(values, undefined, prev2)
```

Important outcomes:

- `startTime` activates the `interval` branch of `oneOf('subDayStrategy', ...)`.
- `everyHour` becomes disabled with reason `"conflicts with interval strategy"`.
- `repeatEvery` and `endTime` are enabled because `startTime` now satisfies their `requires()` dependency.

## Step 4: Reset Recommendations

If `everyHour` did not hold a value, there is nothing to reset:

```ts
recurrenceUmp.flag({ values: prev2 }, { values })
// []
```

If it did hold a value, `flag()` recommends clearing it:

```ts
recurrenceUmp.flag(
  { values: { ...prev2, everyHour: [9, 17] } },
  { values },
)
// [
//   {
//     field: 'everyHour',
//     reason: 'conflicts with interval strategy',
//     suggestedValue: undefined,
//   },
// ]
```

## Why This Example Matters

This is where the rule split pays off:

- `disables('dates', ...)` keeps stale explicit dates authoritative until cleared.
- `oneOf()` resolves the mutually exclusive sub-day strategies.
- `requires()` propagates availability from `startTime` into `endTime` and `repeatEvery`.

The behavior stays declarative even though the interaction is not simple.
