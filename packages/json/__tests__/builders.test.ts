import { enabledWhen, umpire } from '@umpire/core'

import {
  anyOfJson,
  checks,
  createJsonRules,
  toJson,
} from '../src/index.js'
import type { UmpireJsonSchema } from '../src/index.js'

describe('portable JSON builders', () => {
  test('builder-authored expr rules serialize to exact JSON', () => {
    const fields = {
      pitchType: {},
      starter: { required: true },
      walkSignal: {},
      warmupNotice: {},
      bullpenCart: {},
      dugoutTablet: {},
    }
    const conditions = {
      isPlayoffs: { type: 'boolean' as const },
      weatherBand: { type: 'string' as const },
      availableStarters: { type: 'string[]' as const },
    }

    type Conditions = {
      isPlayoffs: boolean
      weatherBand: string
      availableStarters: string[]
    }

    const {
      expr,
      enabledWhenExpr,
      fairWhenExpr,
      requiresJson,
      requiresExpr,
      disablesExpr,
      anyOfJson,
    } = createJsonRules<typeof fields, Conditions>()

    const rules = [
      anyOfJson(
        enabledWhenExpr('warmupNotice', expr.eq('pitchType', 'slider'), {
          reason: 'Needs a slider call',
        }),
        enabledWhenExpr('warmupNotice', expr.eq('pitchType', 'curveball'), {
          reason: 'Needs a curveball call',
        }),
      ),
      fairWhenExpr('starter', expr.fieldInCond('starter', 'availableStarters'), {
        reason: 'Starter must be on tonight\'s card',
      }),
      requiresJson(
        'bullpenCart',
        'pitchType',
        expr.check('starter', checks.minLength(4)),
        {
          reason: 'Bullpen cart waits for a pitch call and a full starter name',
        },
      ),
      requiresExpr(
        'bullpenCart',
        expr.fieldInCond('starter', 'availableStarters'),
        {
          reason: 'Bullpen cart waits for an available starter',
        },
      ),
      disablesExpr(
        expr.or(
          expr.condEq('weatherBand', 'windy'),
          expr.truthy('walkSignal'),
        ),
        ['dugoutTablet'],
        {
          reason: 'Review board locked during windy or intentional-walk moments',
        },
      ),
    ]

    const expected: UmpireJsonSchema = {
      version: 1,
      conditions,
      fields: {
        pitchType: {},
        starter: { required: true },
        walkSignal: {},
        warmupNotice: {},
        bullpenCart: {},
        dugoutTablet: {},
      },
      rules: [
        {
          type: 'anyOf',
          rules: [
            {
              type: 'enabledWhen',
              field: 'warmupNotice',
              when: { op: 'eq', field: 'pitchType', value: 'slider' },
              reason: 'Needs a slider call',
            },
            {
              type: 'enabledWhen',
              field: 'warmupNotice',
              when: { op: 'eq', field: 'pitchType', value: 'curveball' },
              reason: 'Needs a curveball call',
            },
          ],
        },
        {
          type: 'fairWhen',
          field: 'starter',
          when: { op: 'fieldInCond', field: 'starter', condition: 'availableStarters' },
          reason: 'Starter must be on tonight\'s card',
        },
        {
          type: 'requires',
          field: 'bullpenCart',
          dependencies: [
            'pitchType',
            {
              op: 'check',
              field: 'starter',
              check: { op: 'minLength', value: 4 },
            },
          ],
          reason: 'Bullpen cart waits for a pitch call and a full starter name',
        },
        {
          type: 'requires',
          field: 'bullpenCart',
          when: { op: 'fieldInCond', field: 'starter', condition: 'availableStarters' },
          reason: 'Bullpen cart waits for an available starter',
        },
        {
          type: 'disables',
          when: {
            op: 'or',
            exprs: [
              { op: 'condEq', condition: 'weatherBand', value: 'windy' },
              { op: 'truthy', field: 'walkSignal' },
            ],
          },
          targets: ['dugoutTablet'],
          reason: 'Review board locked during windy or intentional-walk moments',
        },
      ],
    }

    expect(toJson({ fields, rules, conditions })).toEqual(expected)
  })

  test('builder-authored expr rules execute through core normally', () => {
    const fields = {
      pitchType: {},
      starter: { required: true },
      walkSignal: {},
      warmupNotice: {},
      bullpenCart: {},
      dugoutTablet: {},
    }

    type Conditions = {
      weatherBand: string
      availableStarters: string[]
    }

    const {
      expr,
      enabledWhenExpr,
      fairWhenExpr,
      requiresJson,
      requiresExpr,
      disablesExpr,
      anyOfJson,
    } = createJsonRules<typeof fields, Conditions>()

    const rules = [
      anyOfJson(
        enabledWhenExpr('warmupNotice', expr.eq('pitchType', 'slider'), {
          reason: 'Needs a slider call',
        }),
        enabledWhenExpr('warmupNotice', expr.eq('pitchType', 'curveball'), {
          reason: 'Needs a curveball call',
        }),
      ),
      fairWhenExpr('starter', expr.fieldInCond('starter', 'availableStarters'), {
        reason: 'Starter must be on tonight\'s card',
      }),
      requiresJson(
        'bullpenCart',
        'pitchType',
        expr.check('starter', checks.minLength(4)),
        {
          reason: 'Bullpen cart waits for a pitch call and a full starter name',
        },
      ),
      requiresExpr(
        'bullpenCart',
        expr.fieldInCond('starter', 'availableStarters'),
        {
          reason: 'Bullpen cart waits for an available starter',
        },
      ),
      disablesExpr(
        expr.or(
          expr.condEq('weatherBand', 'windy'),
          expr.truthy('walkSignal'),
        ),
        ['dugoutTablet'],
        {
          reason: 'Review board locked during windy or intentional-walk moments',
        },
      ),
    ]

    const runtime = umpire({
      fields,
      rules,
    })

    expect(runtime.check(
      {
        pitchType: 'slider',
        starter: 'Cole',
        walkSignal: false,
      },
      {
        weatherBand: 'cold',
        availableStarters: ['Cole'],
      },
    )).toMatchObject({
      warmupNotice: { enabled: true, reason: null },
      starter: { fair: true, reason: null },
      bullpenCart: { enabled: true, reason: null },
      dugoutTablet: { enabled: true, reason: null },
    })

    expect(runtime.check(
      {
        pitchType: 'fastball',
        starter: 'Cole',
        walkSignal: true,
      },
      {
        weatherBand: 'windy',
        availableStarters: ['Holmes'],
      },
    )).toMatchObject({
      warmupNotice: { enabled: false, reason: 'Needs a slider call' },
      starter: { fair: false, reason: 'Starter must be on tonight\'s card' },
      bullpenCart: {
        enabled: false,
        reason: 'Bullpen cart waits for an available starter',
      },
      dugoutTablet: {
        enabled: false,
        reason: 'Review board locked during windy or intentional-walk moments',
      },
    })
  })

  test('anyOfJson requires JSON-backed inner rules', () => {
    const fields = {
      warmupNotice: {},
      pitchType: {},
    }

    type Conditions = Record<string, unknown>

    const { expr, enabledWhenExpr } = createJsonRules<typeof fields, Conditions>()

    expect(() =>
      anyOfJson(
        enabledWhenExpr('warmupNotice', expr.eq('pitchType', 'slider')),
        enabledWhen<typeof fields>('warmupNotice', () => true),
      ),
    ).toThrow('anyOfJson() requires every inner rule to carry JSON metadata')
  })

  test('requiresJson supports mixed field and named-check dependencies', () => {
    const fields = {
      email: {},
      password: {},
      submit: {},
    }

    const { expr, requiresJson } = createJsonRules<typeof fields>()

    const rule = requiresJson(
      'submit',
      'password',
      expr.check('email', checks.email()),
      {
        reason: 'Need a valid email and password before submit',
      },
    )

    expect(toJson({
      fields,
      rules: [rule],
    })).toEqual({
      version: 1,
      fields: {
        email: {},
        password: {},
        submit: {},
      },
      rules: [
        {
          type: 'requires',
          field: 'submit',
          dependencies: [
            'password',
            {
              op: 'check',
              field: 'email',
              check: { op: 'email' },
            },
          ],
          reason: 'Need a valid email and password before submit',
        },
      ],
    })
  })

  test('fairWhenExpr preserves named checks for serialization', () => {
    const fields = {
      email: {},
      submit: {},
    }

    const { expr, fairWhenExpr } = createJsonRules<typeof fields>()

    const rule = fairWhenExpr('submit', expr.check('email', checks.email()), {
      reason: 'Submit stays foul until the scorer email is valid',
    })

    expect(toJson({
      fields,
      rules: [rule],
    })).toEqual({
      version: 1,
      fields: {
        email: {},
        submit: {},
      },
      rules: [
        {
          type: 'fairWhen',
          field: 'submit',
          when: {
            op: 'check',
            field: 'email',
            check: { op: 'email' },
          },
          reason: 'Submit stays foul until the scorer email is valid',
        },
      ],
    })
  })
})
