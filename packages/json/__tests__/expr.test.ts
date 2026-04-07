import { compileExpr } from '../src/index.js'

const fieldNames = new Set(['accountType', 'planId', 'quantity', 'enabled'])
const conditions = {
  isAdmin: { type: 'boolean' as const },
  validPlans: { type: 'string[]' as const },
  accountTier: { type: 'string' as const },
}

describe('compileExpr', () => {
  test('compiles field comparisons and boolean combinators', () => {
    const predicate = compileExpr(
      {
        op: 'and',
        exprs: [
          { op: 'eq', field: 'accountType', value: 'business' },
          {
            op: 'or',
            exprs: [
              { op: 'gte', field: 'quantity', value: 10 },
              { op: 'truthy', field: 'enabled' },
            ],
          },
        ],
      },
      { fieldNames, conditions },
    )

    expect(predicate({ accountType: 'business', quantity: 5, enabled: true }, {})).toBe(true)
    expect(predicate({ accountType: 'business', quantity: 5, enabled: false }, {})).toBe(false)
    expect(predicate._checkField).toBeUndefined()
  })

  test('compiles condition expressions including fieldInCond', () => {
    const predicate = compileExpr(
      {
        op: 'and',
        exprs: [
          { op: 'cond', condition: 'isAdmin' },
          { op: 'fieldInCond', field: 'planId', condition: 'validPlans' },
          { op: 'condEq', condition: 'accountTier', value: 'pro' },
        ],
      },
      { fieldNames, conditions },
    )

    expect(
      predicate(
        { planId: 'starter' },
        { isAdmin: true, validPlans: ['starter', 'team'], accountTier: 'pro' },
      ),
    ).toBe(true)
    expect(
      predicate(
        { planId: 'legacy' },
        { isAdmin: true, validPlans: ['starter', 'team'], accountTier: 'pro' },
      ),
    ).toBe(false)
  })

  test('throws when a declared condition is missing at runtime', () => {
    const predicate = compileExpr(
      { op: 'cond', condition: 'isAdmin' },
      { fieldNames, conditions },
    )

    expect(() => predicate({}, {})).toThrow('Missing runtime condition "isAdmin"')
  })

  test('throws on unknown fields and invalid fieldInCond condition types', () => {
    expect(() =>
      compileExpr(
        { op: 'eq', field: 'missing', value: 'x' },
        { fieldNames, conditions },
      ),
    ).toThrow('Unknown field "missing"')

    expect(() =>
      compileExpr(
        { op: 'fieldInCond', field: 'planId', condition: 'accountTier' },
        { fieldNames, conditions },
      ),
    ).toThrow('"fieldInCond" requires an array condition')
  })
})
