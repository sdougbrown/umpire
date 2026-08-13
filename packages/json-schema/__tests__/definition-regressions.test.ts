import { describe, expect, test } from 'bun:test'

import { compileProfile } from '../src/index.js'

type JsonObject = Record<string, unknown>

type ProfileOptions = {
  name?: string
  defaultValue?: unknown
  conditions?: JsonObject
  rules?: unknown[]
  defs?: JsonObject
}

function profileFor(schema: unknown, options: ProfileOptions = {}): JsonObject {
  const name = options.name ?? 'value'
  const field: JsonObject = { isEmpty: 'present' }
  if ('defaultValue' in options) field.default = options.defaultValue
  return {
    $schema:
      'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
    profileVersion: 1,
    valueSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { [name]: schema },
      required: [],
      additionalProperties: false,
      ...(options.defs ? { $defs: options.defs } : {}),
    },
    umpire: {
      version: 1,
      fields: { [name]: field },
      rules: options.rules ?? [],
      ...(options.conditions ? { conditions: options.conditions } : {}),
    },
  }
}

function expectDefinitionIssues(
  raw: unknown,
  expected: Array<[code: string, path: string]>,
): void {
  const result = compileProfile(raw)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.issues.map(({ code, path }) => [code, path]).sort()).toEqual(
    expected.sort(),
  )
}

function expectDefinitionIssue(raw: unknown, code: string, path: string): void {
  expectDefinitionIssues(raw, [[code, path]])
}

const strictStringObject = {
  type: 'object',
  properties: { value: { type: 'string' } },
  required: [],
  additionalProperties: false,
}

const taggedUnion = {
  oneOf: [
    {
      type: 'object',
      properties: {
        kind: { const: 'manual' },
        instructions: { type: 'string' },
      },
      required: ['kind', 'instructions'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { kind: { const: 'run' }, command: { type: 'string' } },
      required: ['kind', 'command'],
      additionalProperties: false,
    },
  ],
}

describe('RC3 definition issue paths', () => {
  test('meta-schema still rejects unknown canonical wrapper members', () => {
    expectDefinitionIssue(
      { ...profileFor({ type: 'string' }), extra: true },
      'invalidProfile',
      '/',
    )
  })

  test.each([
    ['non-array rules', null],
    ['non-object rule', [null]],
    [
      'non-object oneOf branches',
      [{ type: 'oneOf', group: 'choice', branches: null }],
    ],
    [
      'non-array eitherOf branch rules',
      [{ type: 'eitherOf', group: 'choice', branches: { first: null } }],
    ],
    ['non-array anyOf rules', [{ type: 'anyOf', rules: null }]],
  ])('returns invalidProfile without throwing for malformed %s', (_, rules) => {
    const raw = profileFor({ type: 'string' })
    ;(raw.umpire as JsonObject).rules = rules
    expect(() => compileProfile(raw)).not.toThrow()
    expectDefinitionIssue(raw, 'invalidProfile', '/umpire')
  })

  test('rejects root oneOf while preserving property tagged unions', () => {
    const rootUnion = profileFor({ type: 'string' })
    ;(rootUnion.valueSchema as JsonObject).oneOf = taggedUnion.oneOf
    expectDefinitionIssue(rootUnion, 'unsupportedKeyword', '/valueSchema/oneOf')

    expect(compileProfile(profileFor(taggedUnion)).ok).toBe(true)

    const withNonDiscriminatorConst = {
      oneOf: taggedUnion.oneOf.map((branch) => ({
        ...branch,
        properties: {
          version: { type: 'string', const: 'v1' },
          ...branch.properties,
        },
        required: [...branch.required, 'version'],
      })),
    }
    expect(compileProfile(profileFor(withNonDiscriminatorConst)).ok).toBe(true)
  })

  test.each([
    ['allOf'],
    ['anyOf'],
    ['not'],
    ['uniqueItems'],
    ['pattern'],
    ['format'],
    ['$dynamicRef'],
    ['$recursiveRef'],
    ['if'],
    ['then'],
    ['else'],
    ['prefixItems'],
    ['contains'],
    ['multipleOf'],
    ['patternProperties'],
    ['propertyNames'],
    ['dependentRequired'],
    ['dependentSchemas'],
    ['contentEncoding'],
    ['contentMediaType'],
    ['contentSchema'],
    ['default'],
    ['x-transform'],
  ])('rejects excluded keyword %s at its exact path', (keyword) => {
    expectDefinitionIssue(
      profileFor({ type: 'string', [keyword]: true }),
      'unsupportedKeyword',
      `/valueSchema/properties/value/${keyword}`,
    )
  })

  test.each([[['string', 'null']], [['string', 'number']], ['null']])(
    'rejects unsupported type shape %j as invalidProfile',
    (type) => {
      expectDefinitionIssue(
        profileFor({ type }),
        'invalidProfile',
        '/valueSchema/properties/value/type',
      )
    },
  )

  test('uses documented array-shape codes and paths', () => {
    expectDefinitionIssue(
      profileFor({ type: 'array', items: [{ type: 'string' }] }),
      'invalidProfile',
      '/valueSchema/properties/value/items',
    )
    expectDefinitionIssue(
      profileFor({ type: 'array' }),
      'invalidProfile',
      '/valueSchema/properties/value',
    )
  })

  test('uses one aggregate discriminator path for malformed unions', () => {
    const path = '/valueSchema/properties/value/oneOf'
    expectDefinitionIssue(
      profileFor({ oneOf: [{ type: 'string' }, { type: 'number' }] }),
      'invalidDiscriminator',
      path,
    )
    expectDefinitionIssue(
      profileFor({
        oneOf: [
          {
            type: 'object',
            properties: { kind: { const: 'same' } },
            required: ['kind'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: { kind: { const: 'same' } },
            required: ['kind'],
            additionalProperties: false,
          },
        ],
      }),
      'invalidDiscriminator',
      path,
    )
    expectDefinitionIssue(
      profileFor({
        oneOf: taggedUnion.oneOf.map((branch) => ({
          ...branch,
          required: branch.required.filter((name) => name !== 'kind'),
        })),
      }),
      'invalidDiscriminator',
      path,
    )
  })
})

describe('strict schema invariants', () => {
  test('distinguishes missing and non-false additionalProperties paths', () => {
    const rootMissing = profileFor({ type: 'string' })
    delete (rootMissing.valueSchema as JsonObject).additionalProperties
    expectDefinitionIssue(rootMissing, 'invalidProfile', '/valueSchema')

    const rootTrue = profileFor({ type: 'string' })
    ;(rootTrue.valueSchema as JsonObject).additionalProperties = true
    expectDefinitionIssue(
      rootTrue,
      'invalidProfile',
      '/valueSchema/additionalProperties',
    )

    expectDefinitionIssue(
      profileFor({ type: 'object', properties: {} }),
      'invalidProfile',
      '/valueSchema/properties/value',
    )
    expectDefinitionIssue(
      profileFor({
        type: 'object',
        properties: {},
        additionalProperties: true,
      }),
      'invalidProfile',
      '/valueSchema/properties/value/additionalProperties',
    )
  })

  test('requires explicit object type, properties, and declared required names', () => {
    expectDefinitionIssue(
      profileFor({ properties: {}, additionalProperties: false }),
      'invalidProfile',
      '/valueSchema/properties/value',
    )
    expectDefinitionIssue(
      profileFor({ type: 'object', additionalProperties: false }),
      'invalidProfile',
      '/valueSchema/properties/value',
    )
    expectDefinitionIssue(
      profileFor({
        type: 'object',
        properties: {},
        required: ['missing'],
        additionalProperties: false,
      }),
      'invalidProfile',
      '/valueSchema/properties/value/required',
    )
  })

  test('rejects root required names absent from root properties', () => {
    const raw = profileFor({ type: 'string' })
    ;(raw.valueSchema as JsonObject).required = ['missing']
    expectDefinitionIssue(raw, 'invalidProfile', '/valueSchema/required')
  })

  test('does not resolve inherited definition or required-property names', () => {
    expectDefinitionIssue(
      profileFor({ $ref: '#/$defs/toString' }),
      'invalidReference',
      '/valueSchema/properties/value/$ref',
    )

    expectDefinitionIssue(
      profileFor({
        type: 'object',
        properties: {},
        required: ['toString'],
        additionalProperties: false,
      }),
      'invalidProfile',
      '/valueSchema/properties/value/required',
    )

    const root = profileFor({ type: 'string' })
    ;(root.valueSchema as JsonObject).required = ['toString']
    expectDefinitionIssue(root, 'invalidProfile', '/valueSchema/required')
  })

  test('validates schema shapes reached through $defs and escaped local refs', () => {
    const valid = profileFor(
      { $ref: '#/$defs/A~1B' },
      { defs: { 'A/B': strictStringObject } },
    )
    expect(compileProfile(valid).ok).toBe(true)

    expectDefinitionIssue(
      profileFor(
        { $ref: '#/$defs/Bad' },
        {
          defs: {
            Bad: { type: 'object', properties: {}, additionalProperties: true },
          },
        },
      ),
      'invalidProfile',
      '/valueSchema/$defs/Bad/additionalProperties',
    )
  })

  test('rejects nested root-only schema keywords', () => {
    expectDefinitionIssue(
      profileFor({
        type: 'string',
        $defs: { Nested: { type: 'string' } },
      }),
      'unsupportedKeyword',
      '/valueSchema/properties/value/$defs',
    )
  })
})

describe('deterministic Go generated names', () => {
  test('rejects invalid and colliding property and definition names', () => {
    expectDefinitionIssue(
      profileFor({ type: 'string' }, { name: '123value' }),
      'invalidName',
      '/valueSchema/properties/123value',
    )
    expectDefinitionIssue(
      profileFor({ type: 'string' }, { name: 'type' }),
      'invalidName',
      '/valueSchema/properties/type',
    )

    const collision = profileFor({ type: 'string' })
    ;(collision.valueSchema as JsonObject).properties = {
      'user-id': { type: 'string' },
      user_id: { type: 'string' },
    }
    ;(collision.umpire as JsonObject).fields = {
      'user-id': { isEmpty: 'string' },
      user_id: { isEmpty: 'string' },
    }
    expectDefinitionIssue(collision, 'nameCollision', '/valueSchema/properties')

    expectDefinitionIssue(
      profileFor(
        { $ref: '#/$defs/type' },
        { defs: { type: { type: 'string' } } },
      ),
      'invalidName',
      '/valueSchema/$defs/type',
    )
  })

  test('audits nested fields, enum constants, variants, conditions, and branch groups', () => {
    expectDefinitionIssue(
      profileFor({
        type: 'object',
        properties: {
          'user-id': { type: 'string' },
          user_id: { type: 'string' },
        },
        additionalProperties: false,
      }),
      'nameCollision',
      '/valueSchema/properties/value/properties',
    )
    expectDefinitionIssue(
      profileFor({ type: 'string', enum: ['ready-now', 'ready_now'] }),
      'nameCollision',
      '/valueSchema/properties/value/enum',
    )
    expectDefinitionIssue(
      profileFor({
        oneOf: taggedUnion.oneOf.map((branch, index) => ({
          ...branch,
          properties: {
            ...branch.properties,
            kind: { const: index === 0 ? 'ready-now' : 'ready_now' },
          },
        })),
      }),
      'nameCollision',
      '/valueSchema/properties/value/oneOf',
    )
    expectDefinitionIssue(
      profileFor(
        { type: 'string' },
        {
          conditions: {
            'allow-edit': { type: 'boolean' },
            allow_edit: { type: 'boolean' },
          },
        },
      ),
      'nameCollision',
      '/umpire/conditions',
    )
    expectDefinitionIssue(
      profileFor(
        { type: 'string' },
        {
          rules: [
            {
              type: 'oneOf',
              group: 'choice',
              branches: { 'ready-now': ['value'], ready_now: ['value'] },
            },
          ],
        },
      ),
      'nameCollision',
      '/umpire/rules/0/branches',
    )
  })

  test('detects collisions with nested types and default helper names', () => {
    expectDefinitionIssue(
      profileFor(
        { type: 'object', properties: {}, additionalProperties: false },
        { defs: { 'fields-value': strictStringObject } },
      ),
      'nameCollision',
      '/valueSchema/$defs/fields-value',
    )
    expectDefinitionIssue(
      profileFor({ type: 'string' }, { defs: { fields: strictStringObject } }),
      'nameCollision',
      '/valueSchema/$defs/fields',
    )
  })

  test('detects collisions across generated symbol categories', () => {
    const enumAndObject = profileFor({ type: 'string' })
    ;(enumAndObject.valueSchema as JsonObject).properties = {
      status: { type: 'string', enum: ['ready'] },
      'status-value-ready': strictStringObject,
    }
    ;(enumAndObject.umpire as JsonObject).fields = {
      status: { isEmpty: 'string' },
      'status-value-ready': { isEmpty: 'object' },
    }
    expectDefinitionIssue(
      enumAndObject,
      'nameCollision',
      '/valueSchema/properties/status-value-ready',
    )

    expectDefinitionIssue(
      profileFor(
        { type: 'string' },
        {
          defs: { 'choice-branch': strictStringObject },
          rules: [
            {
              type: 'oneOf',
              group: 'choice',
              branches: { first: ['value'], second: ['value'] },
            },
          ],
        },
      ),
      'nameCollision',
      '/umpire/rules/0/group',
    )
  })
})

describe('numeric safety and defaults', () => {
  test.each([
    [
      { type: 'integer', const: Number.MAX_SAFE_INTEGER + 1 },
      '/valueSchema/properties/value/const',
    ],
    [
      { type: 'integer', enum: [1, Number.MAX_SAFE_INTEGER + 1] },
      '/valueSchema/properties/value/enum',
    ],
    [
      { type: 'integer', maximum: Number.MAX_SAFE_INTEGER + 1 },
      '/valueSchema/properties/value/maximum',
    ],
    [
      {
        type: 'array',
        items: { type: 'string' },
        maxItems: Number.MAX_SAFE_INTEGER + 1,
      },
      '/valueSchema/properties/value/maxItems',
    ],
    [
      { type: 'number', const: Number.POSITIVE_INFINITY },
      '/valueSchema/properties/value/const',
    ],
  ])('rejects unsafe schema literal at %s', (schema, path) => {
    expectDefinitionIssue(profileFor(schema), 'unsafeNumber', path)
  })

  test('rejects unsafe defaults, including through local references', () => {
    expectDefinitionIssue(
      profileFor(
        { $ref: '#/$defs/Count' },
        {
          defs: { Count: { type: 'integer' } },
          defaultValue: Number.MAX_SAFE_INTEGER + 1,
        },
      ),
      'invalidDefault',
      '/umpire/fields/value/default',
    )
    expectDefinitionIssue(
      profileFor(
        { type: 'number' },
        { defaultValue: Number.POSITIVE_INFINITY },
      ),
      'invalidDefault',
      '/umpire/fields/value/default',
    )
  })

  test.each([Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER])(
    'accepts safe integer boundary %d in schemas, defaults, and values',
    (boundary) => {
      const result = compileProfile(
        profileFor(
          { type: 'integer', const: boundary },
          { defaultValue: boundary },
        ),
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.profile.validateStructure({ value: boundary })).toEqual({
        valid: true,
        issues: [],
      })
    },
  )

  test('reports only the applicable runtime numeric issue', () => {
    const integer = compileProfile(profileFor({ type: 'integer' }))
    expect(integer.ok).toBe(true)
    if (integer.ok) {
      expect(
        integer.profile
          .validateStructure({ value: 1.5 })
          .issues.map(({ code, path }) => [code, path]),
      ).toEqual([['type', '/value']])
      expect(
        integer.profile
          .validateStructure({ value: Number.MAX_SAFE_INTEGER + 1 })
          .issues.map(({ code, path }) => [code, path]),
      ).toEqual([['safeInteger', '/value']])
    }

    const number = compileProfile(profileFor({ type: 'number' }))
    expect(number.ok).toBe(true)
    if (number.ok) {
      expect(
        number.profile
          .validateStructure({ value: Number.POSITIVE_INFINITY })
          .issues.map(({ code, path }) => [code, path]),
      ).toEqual([['type', '/value']])
    }
  })

  test.each(['a/b', 'a~b'])(
    'escapes field %s while matching and reporting an invalid default',
    (name) => {
      expectDefinitionIssue(
        profileFor({ type: 'integer' }, { name, defaultValue: 1.5 }),
        'invalidDefault',
        `/umpire/fields/${name.replace(/~/g, '~0').replace(/\//g, '~1')}/default`,
      )
    },
  )

  test('treats tagged unions as objects for isEmpty compatibility', () => {
    const incompatible = profileFor(taggedUnion)
    ;((incompatible.umpire as JsonObject).fields as JsonObject).value = {
      isEmpty: 'string',
    }
    expectDefinitionIssue(
      incompatible,
      'incompatibleIsEmpty',
      '/umpire/fields/value',
    )

    const compatible = profileFor(taggedUnion)
    ;((compatible.umpire as JsonObject).fields as JsonObject).value = {
      isEmpty: 'object',
    }
    expect(compileProfile(compatible).ok).toBe(true)
  })

  test('resolves refs for isEmpty compatibility', () => {
    const raw = profileFor(
      { $ref: '#/$defs/Count' },
      { defs: { Count: { type: 'integer' } } },
    )
    ;((raw.umpire as JsonObject).fields as JsonObject).value = {
      isEmpty: 'string',
    }
    expectDefinitionIssue(raw, 'incompatibleIsEmpty', '/umpire/fields/value')
  })
})
