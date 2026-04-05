import { umpire } from '@umpire/core'
import {
  ReadInputType,
  createReads,
  enabledWhenRead,
  fairWhenRead,
  fromRead,
} from '../src/index.js'

describe('@umpire/reads', () => {
  test('resolves reads, preserves dependency inspection, and exposes predicate helpers', () => {
    const reads = createReads<
      { cpu?: string; motherboard?: string },
      { cpuSelected: boolean; motherboardMatchesCpu: boolean }
    >({
      cpuSelected: ({ input }) => Boolean(input.cpu),
      motherboardMatchesCpu: ({ input, read }) =>
        read('cpuSelected') && input.motherboard === input.cpu,
    })

    expect(reads.resolve({ cpu: 'am5', motherboard: 'am5' })).toEqual({
      cpuSelected: true,
      motherboardMatchesCpu: true,
    })

    expect(reads.inspect({ cpu: 'am5', motherboard: 'lga1700' })).toEqual({
      values: {
        cpuSelected: true,
        motherboardMatchesCpu: false,
      },
      nodes: {
        cpuSelected: {
          id: 'cpuSelected',
          value: true,
          dependsOnReads: [],
          dependsOnFields: ['cpu'],
        },
        motherboardMatchesCpu: {
          id: 'motherboardMatchesCpu',
          value: false,
          dependsOnReads: ['cpuSelected'],
          dependsOnFields: ['motherboard', 'cpu'],
        },
      },
      bridges: [],
      graph: {
        nodes: ['cpuSelected', 'motherboardMatchesCpu'],
        edges: [
          {
            from: 'cpu',
            to: 'cpuSelected',
            type: 'field',
          },
          {
            from: 'cpuSelected',
            to: 'motherboardMatchesCpu',
            type: 'read',
          },
          {
            from: 'motherboard',
            to: 'motherboardMatchesCpu',
            type: 'field',
          },
          {
            from: 'cpu',
            to: 'motherboardMatchesCpu',
            type: 'field',
          },
        ],
      },
    })

    const predicate = fromRead(reads, 'motherboardMatchesCpu')

    expect(predicate(undefined, { cpu: 'am5', motherboard: 'am5' })).toBe(true)
    expect(predicate(undefined, { cpu: 'am5', motherboard: 'lga1700' })).toBe(false)
  })

  test('bridges reads into enabledWhen and fairWhen rules', () => {
    const availabilityReads = createReads<
      { allowMotherboard: boolean },
      { canSelectMotherboard: boolean }
    >({
      canSelectMotherboard: ({ input }) => input.allowMotherboard,
    })

    const availabilityUmp = umpire<
      {
        motherboard: {}
      },
      { allowMotherboard: boolean }
    >({
      fields: {
        motherboard: {},
      },
      rules: [
        enabledWhenRead('motherboard', 'canSelectMotherboard', availabilityReads, {
          inputType: ReadInputType.CONDITIONS,
          reason: 'Pick a supported platform first',
        }),
      ],
    })

    expect(availabilityUmp.check({ motherboard: 'am5' }, { allowMotherboard: false }).motherboard)
      .toEqual({
        enabled: false,
        fair: true,
        required: false,
        reason: 'Pick a supported platform first',
        reasons: ['Pick a supported platform first'],
      })

    const fairnessReads = createReads<
      { cpu?: string; motherboard?: string },
      { motherboardFair: boolean }
    >({
      motherboardFair: ({ input }) => input.cpu === input.motherboard,
    })

    const fairnessUmp = umpire({
      fields: {
        cpu: {},
        motherboard: {},
      },
      rules: [
        fairWhenRead('motherboard', 'motherboardFair', fairnessReads, {
          reason: 'Selected motherboard no longer matches the CPU socket',
        }),
      ],
    })

    expect(fairnessUmp.check({ cpu: 'am5', motherboard: 'lga1700' }).motherboard).toEqual({
      enabled: true,
      fair: false,
      required: false,
      reason: 'Selected motherboard no longer matches the CPU socket',
      reasons: ['Selected motherboard no longer matches the CPU socket'],
    })
  })

  test('uses the renamed circular dependency error', () => {
    const reads = createReads<{}, { alpha: boolean; beta: boolean }>({
      alpha: ({ read }) => read('beta'),
      beta: ({ read }) => read('alpha'),
    })

    expect(() => reads.resolve({})).toThrow('createReads circular dependency: alpha -> beta -> alpha')
  })
})
