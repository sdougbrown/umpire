import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { compileProfile, filterStructuralIssues } from '../src/index.js'
import type { ProfileDocument, StructuralIssue } from '../src/schema.js'

type StructuralExpected = {
  valid: boolean
  issues: { source: 'json-schema'; code: string; path: string }[]
}

type Case = {
  id: string
  description?: string
  values: Record<string, unknown>
  conditions?: Record<string, unknown>
  prev?: Record<string, unknown>
  expectedStructure: StructuralExpected
  expectedAvailability?: Record<string, Record<string, unknown>>
}

type ProfileFixture = {
  fixtureVersion: 1
  id: string
  description?: string
  profile: ProfileDocument
  cases: Case[]
}

type ExpectedDefinitionIssue = { code: string; path: string }

type Failure = {
  id: string
  description?: string
  profile: ProfileDocument
  expectedDefinitionIssues?: ExpectedDefinitionIssue[]
}

type FailureFixture = {
  fixtureVersion: 1
  id: string
  description?: string
  failures: Failure[]
}

const conformanceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../conformance',
)

const index = JSON.parse(
  readFileSync(path.join(conformanceDir, 'index.json'), 'utf8'),
) as {
  fixtureVersion: number
  fixtures: { id: string; path: string; description?: string }[]
  failures: { id: string; path: string; description?: string }[]
}

function loadProfileFixtures(): ProfileFixture[] {
  return index.fixtures.map(
    (entry) =>
      JSON.parse(
        readFileSync(path.join(conformanceDir, entry.path), 'utf8'),
      ) as ProfileFixture,
  )
}

function loadFailureFixtures(): FailureFixture[] {
  return index.failures.map(
    (entry) =>
      JSON.parse(
        readFileSync(path.join(conformanceDir, entry.path), 'utf8'),
      ) as FailureFixture,
  )
}

function normalizeStructuralIssues(issues: StructuralIssue[]): string[] {
  return issues.map((i) => `${i.source}|${i.code}|${i.path}`).sort()
}

describe('profile conformance fixtures', () => {
  const fixtures = loadProfileFixtures()
  test.each(fixtures)('$id compiles and matches cases', (fixture) => {
    expect(fixture.fixtureVersion).toBe(1)

    const result = compileProfile(fixture.profile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { profile } = result

    for (const testCase of fixture.cases) {
      // Structural parity — exact issue tuples.
      const structure = profile.validateStructure(testCase.values)
      expect(structure.valid).toBe(testCase.expectedStructure.valid)
      expect(normalizeStructuralIssues(structure.issues)).toEqual(
        (testCase.expectedStructure.issues ?? [])
          .map((i) => `${i.source}|${i.code}|${i.path}`)
          .sort(),
      )

      // Availability parity for cases that declare expected availability.
      if (testCase.expectedAvailability) {
        const availability = profile.check(
          testCase.values,
          testCase.conditions,
          testCase.prev,
        ) as Record<string, Record<string, unknown>>

        expect(availability).toEqual(testCase.expectedAvailability)
      }
    }
  })
})

describe('profile definition failure fixtures', () => {
  const fixtures = loadFailureFixtures()
  test.each(fixtures)(
    '$id rejects with expected definition issues',
    (fixture) => {
      expect(fixture.fixtureVersion).toBe(1)

      for (const failure of fixture.failures) {
        const result = compileProfile(failure.profile)
        expect(result.ok).toBe(false)

        if (!result.ok) {
          const byKey = new Map(
            result.issues.map((i) => [`${i.code}|${i.path}`, i]),
          )
          for (const expected of failure.expectedDefinitionIssues ?? []) {
            expect(byKey.has(`${expected.code}|${expected.path}`)).toBe(true)
          }
        }
      }
    },
  )
})

// Lock in Option Y: profile availability reuses base Umpire condition
// semantics, so an unsupplied `cond` condition throws instead of being
// defaulted. This guards against reintroducing a condition-default shim.
describe('unsupplied conditions throw (base Umpire semantics)', () => {
  const fixture = loadProfileFixtures().find((f) => f.id === 'avenor-workflow')
  if (!fixture) {
    throw new Error(
      'Missing conformance fixture "avenor-workflow" — expected by unsupplied-conditions tests.',
    )
  }

  const fixtureCase = fixture.cases.find(
    (c) => c.id === 'minimal-valid-workflow',
  )
  if (!fixtureCase) {
    throw new Error(
      `Fixture "avenor-workflow" is missing expected case "minimal-valid-workflow".`,
    )
  }
  const caseValues = fixtureCase.values

  test('evaluating a rule with an unsupplied condition throws', () => {
    const result = compileProfile(fixture.profile)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Do not supply conditions — the status rule gates on allowEdits.
    expect(() => result.profile.check(caseValues)).toThrow(
      'Missing runtime condition "allowEdits"',
    )
  })

  test('the same case succeeds when allowEdits is supplied explicitly', () => {
    const result = compileProfile(fixture.profile)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const availability = result.profile.check(caseValues, { allowEdits: false })
    expect(availability.status?.enabled).toBe(false)
  })
})

describe('filterStructuralIssues over fixture cases', () => {
  const fixtures = loadProfileFixtures()
  test.each(fixtures)('$id filtering is stable', (fixture) => {
    const result = compileProfile(fixture.profile)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { profile } = result
    for (const testCase of fixture.cases) {
      // filterStructuralIssues is about the UI consumption of availability, so
      // only evaluate it where the fixture defines availability (those cases
      // supply the conditions their rules reference).
      if (!testCase.expectedAvailability) continue
      const structure = profile.validateStructure(testCase.values)
      const availability = profile.check(
        testCase.values,
        testCase.conditions,
        testCase.prev,
      )
      const filtered = filterStructuralIssues(availability, structure.issues)
      // Filtering never adds issues.
      expect(filtered.length).toBeLessThanOrEqual(structure.issues.length)
      // An enabled top-level field never has its own issue filtered away.
      for (const [field, status] of Object.entries(availability)) {
        if (status.enabled) {
          expect(filtered.some((i) => i.path === `/${field}`)).toBe(
            structure.issues.some((i) => i.path === `/${field}`),
          )
        }
      }
    }
  })
})
