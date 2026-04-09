import type { AvailabilityMap } from '@umpire/core'
import { enabledWhen, umpire } from '@umpire/core'
import { z } from 'zod'
import { activeSchema } from '../src/active-schema.js'
import { zodValidationExtension } from '../src/devtools.js'

type TestFields = {
  email: {}
  companyName: {}
  companySize: {}
}

function createAvailability(
  overrides: Partial<AvailabilityMap<TestFields>> = {},
): AvailabilityMap<TestFields> {
  return {
    email: {
      enabled: true,
      required: true,
      reason: null,
      reasons: [],
    },
    companyName: {
      enabled: false,
      required: false,
      reason: 'business plan required',
      reasons: ['business plan required'],
    },
    companySize: {
      enabled: true,
      required: true,
      reason: null,
      reasons: [],
    },
    ...overrides,
  }
}

const demoUmp = umpire({
  fields: {
    email: { default: '' },
    companyName: { default: '' },
    companySize: { default: '' },
  },
  rules: [],
})

describe('zodValidationExtension', () => {
  test('summarizes surfaced, suppressed, and unmapped issues from a safeParse result', () => {
    const result = z.object({
      email: z.string().email('Enter a valid email'),
      companyName: z.string().min(1, 'Company name is required'),
      companySize: z.string().min(1, 'Company size is required'),
    }).safeParse({
      email: 'nope',
      companyName: '',
      companySize: '',
    })

    if (result.success) {
      throw new Error('Expected parse to fail')
    }

    const extension = zodValidationExtension({
      availability: createAvailability(),
      result,
      schemaFields: ['email', 'companySize'],
    })

    const view = extension.inspect({
      conditions: { plan: 'business' },
      previous: null,
      scorecard: demoUmp.scorecard({
        values: {
          email: '',
          companyName: '',
          companySize: '',
        },
        conditions: {},
      }),
      ump: demoUmp,
      values: {
        email: '',
        companyName: '',
        companySize: '',
      },
    })

    expect(view?.sections[0]).toEqual({
      kind: 'badges',
      title: 'Summary',
      badges: expect.arrayContaining([
        { tone: 'disabled', value: 'invalid' },
        { tone: 'accent', value: 'errors 2' },
        { tone: 'muted', value: 'suppressed 1' },
        { tone: 'fair', value: 'unmapped 0' },
      ]),
    })

    expect(view?.sections[1]?.title).toBe('Active Error Map')
    expect(view?.sections[2]?.title).toBe('Active Schema')

    expect(view?.sections).toContainEqual({
      kind: 'rows',
      title: 'Active Error Map',
      rows: [
        { label: 'email', value: 'Enter a valid email' },
        { label: 'companySize', value: 'Company size is required' },
      ],
    })

    expect(view?.sections).toContainEqual({
      kind: 'items',
      title: 'Suppressed Issues',
      items: [{
        id: 'companyName:0',
        title: 'companyName',
        badge: { tone: 'muted', value: 'disabled' },
        body: 'Company name is required',
        rows: [{ label: 'availability reason', value: 'business plan required' }],
      }],
    })

  })

  test('labels form-level issues as unmapped', () => {
    const extension = zodValidationExtension({
      availability: createAvailability(),
      result: {
        success: false,
        error: {
          issues: [{
            path: [],
            message: 'Passwords do not match',
          }],
        },
      },
    })

    const view = extension.inspect({
      conditions: undefined,
      previous: null,
      scorecard: demoUmp.scorecard({
        values: {
          email: '',
          companyName: '',
          companySize: '',
        },
      }),
      ump: demoUmp,
      values: {
        email: '',
        companyName: '',
        companySize: '',
      },
    })

    expect(view?.sections).toContainEqual({
      kind: 'items',
      title: 'Unmapped Issues',
      items: [{
        id: ':0',
        title: '(form)',
        badge: { tone: 'fair', value: 'unmapped' },
        body: 'Passwords do not match',
      }],
    })
  })

  test('can resolve validation from devtools context and scorecard output', () => {
    const contextualUmp = umpire({
      fields: {
        email: { default: '' },
        companyName: { default: '' },
      },
      rules: [
        enabledWhen('companyName', (_v, c: { plan: 'personal' | 'business' }) => c.plan === 'business', {
          reason: 'business plan required',
        }),
      ],
    })

    const values = {
      email: 'nope',
      companyName: '',
    }
    const scorecard = contextualUmp.scorecard({
      values,
      conditions: { plan: 'personal' },
    })

    const extension = zodValidationExtension({
      resolve({ scorecard, values }) {
        const baseSchema = activeSchema(scorecard.check, {
          email: z.string().email('Enter a valid email'),
          companyName: z.string().min(1, 'Company name is required'),
        }, z)

        return {
          result: baseSchema.safeParse(values),
          schemaFields: Object.keys(baseSchema.shape),
        }
      },
    })

    const view = extension.inspect({
      conditions: { plan: 'personal' },
      previous: null,
      scorecard,
      ump: contextualUmp,
      values,
    })

    expect(view?.sections[0]).toEqual({
      kind: 'badges',
      title: 'Summary',
      badges: expect.arrayContaining([
        { tone: 'disabled', value: 'invalid' },
        { tone: 'accent', value: 'errors 1' },
        { tone: 'muted', value: 'suppressed 0' },
        { tone: 'fair', value: 'unmapped 0' },
      ]),
    })

    expect(view?.sections).toContainEqual({
      kind: 'rows',
      title: 'Active Error Map',
      rows: [
        { label: 'email', value: 'Enter a valid email' },
      ],
    })

    expect(view?.sections).toContainEqual({
      kind: 'rows',
      title: 'Active Schema',
      rows: [
        { label: 'field count', value: 1 },
        { label: 'fields', value: 'email' },
      ],
    })
  })
})
