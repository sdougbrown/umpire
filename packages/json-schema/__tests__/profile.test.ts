import { describe, test, expect } from 'bun:test'

import { compileProfile, compileSchemas, filterStructuralIssues } from '../src/index.js'
import type { StructuralIssue } from '../src/schema.js'

import {
  workflowProfile,
  validWorkflowInstance,
  wrongNodesTypeInstance,
  // missingRequiredNodePropInstance,
  unknownNodePropertyInstance,
  invalidDiscriminatorInstance,
  // missingDiscriminatorInstance,
  omittedTagsInstance,
  nullTagsInstance,
  validatorCoexistenceProfile,
  simpleProfile,
  unsupportedKeywordProfile,
  fieldMismatchProfile,
} from './fixtures.js'

describe('compileProfile', () => {
  test('compiles a valid workflow profile', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.profile.check).toBeInstanceOf(Function)
      expect(result.profile.validateStructure).toBeInstanceOf(Function)
      expect(result.profile.evaluate).toBeInstanceOf(Function)
    }
  })

  test('rejects a non-object', () => {
    const result = compileProfile('not-an-object')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0].code).toBe('invalidProfile')
    }
  })

  test('rejects a profile with wrong version', () => {
    const result = compileProfile({
      $schema: 'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
      profileVersion: 2,
      valueSchema: {},
      umpire: {},
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'invalidProfile')).toBe(true)
    }
  })

  test('rejects an unsupported JSON Schema dialect', () => {
    const result = compileProfile({
      $schema: 'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
      profileVersion: 1,
      valueSchema: {
        $schema: 'https://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: { x: { type: 'string' } },
        additionalProperties: false,
      },
      umpire: {
        version: 1,
        fields: { x: {} },
        rules: [],
      },
    })
    expect(result.ok).toBe(false)
  })

  test('rejects unsupported value schema keywords', () => {
    const result = compileProfile(unsupportedKeywordProfile)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // AJV catches unknown format during schema compilation
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })

  test('rejects unsupported keywords that AJV accepts (closed-vocabulary walk)', () => {
    // 'pattern' is supported by AJV but rejected by profile v1's closed vocabulary
    const result = compileProfile({
      $schema: 'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
      profileVersion: 1,
      valueSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          name: { type: 'string', pattern: '^[a-z]+$' },
        },
        additionalProperties: false,
      },
      umpire: {
        version: 1,
        fields: { name: {} },
        rules: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'unsupportedKeyword')).toBe(true)
    }
  })

  test('rejects anyOf keyword via closed-vocabulary walk', () => {
    const result = compileProfile({
      $schema: 'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
      profileVersion: 1,
      valueSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          value: {
            anyOf: [
              { type: 'string' },
              { type: 'number' },
            ],
          },
        },
        additionalProperties: false,
      },
      umpire: {
        version: 1,
        fields: { value: {} },
        rules: [],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // Should catch both anyOf and the fact that anyOf is not in the supported vocabulary
      expect(result.issues.some((i) => i.code === 'unsupportedKeyword' && i.message.includes('anyOf'))).toBe(true)
    }
  })

  test('rejects field/property mismatch', () => {
    const result = compileProfile(fieldMismatchProfile)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'fieldMismatch')).toBe(true)
    }
  })
})

describe('compileSchemas', () => {
  test('compiles separately supplied valueSchema and umpire', () => {
    const result = compileSchemas({
      valueSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: false,
      },
      umpire: {
        version: 1,
        fields: { name: {} },
        rules: [],
      },
    })
    expect(result.ok).toBe(true)
  })

  test('rejects non-object valueSchema', () => {
    const result = compileSchemas({
      valueSchema: 'string',
      umpire: { version: 1, fields: { x: {} }, rules: [] },
    })
    expect(result.ok).toBe(false)
  })
})

describe('CompiledProfile.check()', () => {
  test('delegates to Umpire availability evaluation', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { profile } = result

    // With conditions that enable everything
    const availability = profile.check(validWorkflowInstance, {
      hasNodes: true,
      useTags: true,
    })

    expect(availability.workflowName?.enabled).toBe(true)
    expect(availability.version?.enabled).toBe(true)
    expect(availability.nodes?.enabled).toBe(true)
    expect(availability.tags?.enabled).toBe(true)
  })

  test('respects conditions that disable fields', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { profile } = result

    const availability = profile.check(
      { workflowName: 'test', version: 1 },
      { hasNodes: false, useTags: false },
    )

    expect(availability.nodes?.enabled).toBe(false)
    expect(availability.tags?.enabled).toBe(false)
    expect(availability.workflowName?.enabled).toBe(true)
  })
})

describe('CompiledProfile.validateStructure()', () => {
  test('validates a correct instance', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(validWorkflowInstance)
    expect(structure.valid).toBe(true)
    expect(structure.issues).toHaveLength(0)
  })

  test('catches wrong type for nodes (proving structural validation independent of availability)', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Prove that validateStructure catches the type error
    const structure = result.profile.validateStructure(wrongNodesTypeInstance)
    expect(structure.valid).toBe(false)
    expect(structure.issues.length).toBeGreaterThan(0)

    const typeIssue = structure.issues.find((i) => i.code === 'type')
    expect(typeIssue).toBeDefined()
    expect(typeIssue!.path).toBe('/nodes')
    expect(typeIssue!.source).toBe('json-schema')
  })

  test('catches unknown properties', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(unknownNodePropertyInstance)
    expect(structure.valid).toBe(false)

    const addPropIssue = structure.issues.find(
      (i) => i.code === 'additionalProperties',
    )
    expect(addPropIssue).toBeDefined()
    expect(addPropIssue!.path).toContain('extraProp')
  })

  test('catches invalid discriminator in oneOf', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(invalidDiscriminatorInstance)
    expect(structure.valid).toBe(false)

    // Should have issues about the discriminator
    expect(structure.issues.length).toBeGreaterThan(0)
  })

  test('omitted optional property is structurally valid', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(omittedTagsInstance)
    expect(structure.valid).toBe(true)
    expect(structure.issues).toHaveLength(0)
  })

  test('explicit null for optional property fails with type error', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(nullTagsInstance)
    expect(structure.valid).toBe(false)

    const typeIssue = structure.issues.find((i) => i.code === 'type')
    expect(typeIssue).toBeDefined()
    expect(typeIssue!.path).toBe('/tags')
  })

  test('validates a simple profile instance', () => {
    const result = compileProfile(simpleProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure({ name: 'Alice', age: 30 })
    expect(structure.valid).toBe(true)

    const missingName = result.profile.validateStructure({ age: 30 })
    expect(missingName.valid).toBe(false)
    expect(missingName.issues.some((i) => i.code === 'required')).toBe(true)
  })

  test('structural issues are deduplicated and sorted', () => {
    const result = compileProfile(simpleProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Multiple violations
    const structure = result.profile.validateStructure({ age: -1 })
    expect(structure.valid).toBe(false)

    // Issues should be sorted by path, then code
    for (let i = 1; i < structure.issues.length; i++) {
      const prev = structure.issues[i - 1]
      const curr = structure.issues[i]
      const pathCmp = prev.path.localeCompare(curr.path)
      expect(pathCmp <= 0).toBe(true)
    }
  })
})

describe('CompiledProfile.evaluate()', () => {
  test('returns both availability and structure', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { availability, structure } = result.profile.evaluate(
      validWorkflowInstance,
      { hasNodes: true, useTags: true },
    )

    expect(availability).toBeDefined()
    expect(structure).toBeDefined()
    expect(structure.valid).toBe(true)
    expect(typeof availability.workflowName?.enabled).toBe('boolean')
  })

  test('wrong nodes type yields both satisfied false and structural issues', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { availability, structure } = result.profile.evaluate(
      wrongNodesTypeInstance,
      { hasNodes: true, useTags: true },
    )

    // Umpire reports nodes as not satisfied (since it's a string, not an array)
    expect(availability.nodes?.satisfied).toBe(false)

    // Structural validation catches the type error
    expect(structure.valid).toBe(false)
    expect(structure.issues.some((i) => i.code === 'type' && i.path === '/nodes')).toBe(true)

    // The issues remain separate - they don't mutate availability
    expect(availability.nodes?.valid).toBeUndefined()
    expect(availability.nodes?.error).toBeUndefined()
  })
})

describe('Validator coexistence (item 8)', () => {
  test('existing Umpire validators produce independent valid/error while JSON Schema produces structural issues', () => {
    const result = compileProfile(validatorCoexistenceProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { profile } = result

    // Valid email that also passes structural validation
    const good = profile.evaluate({ email: 'user@example.com', count: 5 })
    expect(good.availability.email?.valid).toBe(true)
    expect(good.structure.valid).toBe(true)

    // Invalid email (fails Umpire validator) but structurally valid
    const badEmail = profile.evaluate({ email: 'not-an-email', count: 5 })
    expect(badEmail.availability.email?.valid).toBe(false)
    expect(badEmail.availability.email?.error).toBe('Must be a valid email')
    expect(badEmail.structure.valid).toBe(true) // still structurally valid as a string

    // Valid email but wrong count type (fails JSON Schema but passes Umpire)
    const badCount = profile.evaluate({ email: 'user@example.com', count: -1 })
    expect(badCount.availability.email?.valid).toBe(true) // Umpire validator passes
    expect(badCount.structure.valid).toBe(false)
    expect(badCount.structure.issues.some((i) => i.code === 'minimum')).toBe(true) // JSON Schema catches negative

    // Both fail independently
    const bothBad = profile.evaluate({ email: 42, count: -1 })
    expect(bothBad.structure.valid).toBe(false)
    // The structural issue for email will be a type error (42 is not a string)
    expect(bothBad.structure.issues.some((i) => i.path === '/email' && i.code === 'type')).toBe(true)
  })
})

describe('Wrong type yields structural issue alongside satisfied: false (item 9)', () => {
  test('wrong nodes type produces structural type issue even when Umpire reports satisfied: false', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { availability, structure } = result.profile.evaluate(
      wrongNodesTypeInstance,
      { hasNodes: true, useTags: true },
    )

    // Both authorities report issues independently
    expect(availability.nodes?.satisfied).toBe(false)
    expect(structure.valid).toBe(false)

    // The type issue is there regardless of Umpire satisfaction
    const typeIssue = structure.issues.find((i) => i.code === 'type')
    expect(typeIssue).toBeDefined()

    // Structural issues never enter availability
    expect(availability.nodes?.valid).toBeUndefined()
    expect(availability.nodes?.error).toBeUndefined()
  })
})

describe('Omitted vs null optional properties (item 10)', () => {
  test('omitted "tags" is structurally valid', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(omittedTagsInstance)
    expect(structure.valid).toBe(true)
    expect(structure.issues).toHaveLength(0)
  })

  test('explicit null "tags" fails with code: "type"', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(nullTagsInstance)
    expect(structure.valid).toBe(false)

    const typeIssue = structure.issues.find((i) => i.code === 'type')
    expect(typeIssue).toBeDefined()
    expect(typeIssue!.path).toBe('/tags')
    // Explicit null fails type check for array
  })
})

describe('filterStructuralIssues', () => {
  test('suppresses issues for disabled fields', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { availability, structure } = result.profile.evaluate(
      wrongNodesTypeInstance,
      { hasNodes: false, useTags: false },
    )

    // Nodes is disabled
    expect(availability.nodes?.enabled).toBe(false)

    // Without filtering, structure issues exist
    expect(structure.issues.length).toBeGreaterThan(0)

    // With filtering, node-related issues are suppressed
    const filtered = filterStructuralIssues(availability, structure.issues)
    const remainingNodesIssues = filtered.filter(
      (i) => i.path === '/nodes',
    )
    expect(remainingNodesIssues).toHaveLength(0)
  })

  test('retains root issues regardless of field status', () => {
    // Root-level type errors (path '/') should always be retained
    const availability = {
      workflowName: { enabled: true, satisfied: true, fair: true, required: true, reason: null, reasons: [] },
    }
    const issues: StructuralIssue[] = [
      {
        source: 'json-schema',
        code: 'type',
        path: '/',
        message: 'must be object',
      },
    ]

    const filtered = filterStructuralIssues(availability, issues)
    expect(filtered).toHaveLength(1)
  })

  test('retains issues for enabled fields', () => {
    const availability = {
      nodes: { enabled: true, satisfied: true, fair: true, required: true, reason: null, reasons: [] },
    }
    const issues: StructuralIssue[] = [
      {
        source: 'json-schema',
        code: 'type',
        path: '/nodes',
        message: 'must be array',
      },
    ]

    const filtered = filterStructuralIssues(availability, issues)
    expect(filtered).toHaveLength(1)
  })

  test('retains nested path issues when the parent field is enabled', () => {
    const availability = {
      nodes: { enabled: true, satisfied: true, fair: true, required: true, reason: null, reasons: [] },
    }
    const issues: StructuralIssue[] = [
      {
        source: 'json-schema',
        code: 'type',
        path: '/nodes/0/id',
        message: 'must be string',
      },
    ]

    const filtered = filterStructuralIssues(availability, issues)
    expect(filtered).toHaveLength(1)
  })
})

describe('Normalized issue contract', () => {
  test('all issues have required fields', () => {
    const result = compileProfile(workflowProfile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const structure = result.profile.validateStructure(wrongNodesTypeInstance)
    expect(structure.valid).toBe(false)

    for (const issue of structure.issues) {
      expect(issue.source).toBe('json-schema')
      expect(typeof issue.code).toBe('string')
      expect(typeof issue.path).toBe('string')
      expect(typeof issue.message).toBe('string')
    }
  })
})
