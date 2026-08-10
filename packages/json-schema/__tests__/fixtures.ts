import type { ProfileDocument } from '../src/schema.js'

/**
 * Avenor-shaped workflow fixture: workflows with nodes, actions, and tags.
 *
 * This fixture exercises:
 * - arrays of node objects
 * - nested strict objects
 * - enums and constants (action types)
 * - local definitions/references ($defs for tags)
 * - manual, run, and loop action variants
 * - required loop properties
 * - unknown properties (discriminator mismatch)
 * - discriminators (oneOf for actions)
 */
export const workflowProfile: ProfileDocument = {
  $schema:
    'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
  profileVersion: 1,
  valueSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      workflowName: { type: 'string' },
      version: { type: 'integer' },
      nodes: {
        type: 'array',
        items: { $ref: '#/$defs/Node' },
        minItems: 1,
        maxItems: 50,
      },
      tags: {
        type: 'array',
        items: { $ref: '#/$defs/Tag' },
      },
    },
    required: ['workflowName', 'version', 'nodes'],
    additionalProperties: false,
    $defs: {
      Node: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 },
          label: { type: 'string' },
          action: { $ref: '#/$defs/Action' },
        },
        required: ['id', 'action'],
        additionalProperties: false,
      },
      Action: {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { type: 'string', const: 'manual' },
              instructions: { type: 'string', minLength: 1 },
            },
            required: ['type', 'instructions'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', const: 'run' },
              script: { type: 'string', minLength: 1 },
              timeout: { type: 'integer', minimum: 1, maximum: 3600 },
            },
            required: ['type', 'script'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', const: 'loop' },
              iterator: { type: 'string', minLength: 1 },
              maxIterations: { type: 'integer', minimum: 1, maximum: 1000 },
            },
            required: ['type', 'iterator', 'maxIterations'],
            additionalProperties: false,
          },
        ],
      },
      Tag: {
        type: 'object',
        properties: {
          key: { type: 'string', minLength: 1 },
          value: { type: 'string' },
        },
        required: ['key', 'value'],
        additionalProperties: false,
      },
    },
  },
  umpire: {
    version: 1,
    fields: {
      workflowName: {},
      version: {},
      nodes: { isEmpty: 'array' },
      tags: {},
    },
    rules: [
      {
        type: 'requires',
        field: 'nodes',
        when: { op: 'cond', condition: 'hasNodes' },
      },
      {
        type: 'requires',
        field: 'tags',
        when: { op: 'cond', condition: 'useTags' },
      },
    ],
    conditions: {
      hasNodes: {
        type: 'boolean',
        description: 'Whether nodes should be active',
      },
      useTags: {
        type: 'boolean',
        description: 'Whether tags should be active',
      },
    },
  },
}

/**
 * Valid instance for the workflow profile.
 */
export const validWorkflowInstance = {
  workflowName: 'deploy-app',
  version: 1,
  nodes: [
    {
      id: 'build',
      label: 'Build application',
      action: { type: 'run', script: 'yarn build', timeout: 300 },
    },
    {
      id: 'approve',
      label: 'Manual approval',
      action: { type: 'manual', instructions: 'Review and approve' },
    },
    {
      id: 'retry-check',
      label: 'Retry check',
      action: {
        type: 'loop',
        iterator: 'attempt',
        maxIterations: 5,
      },
    },
  ],
  tags: [
    { key: 'env', value: 'production' },
    { key: 'team', value: 'platform' },
  ],
}

/**
 * Invalid instances for various tests.
 */

// Wrong type for nodes (should be array, not string)
export const wrongNodesTypeInstance = {
  workflowName: 'test',
  version: 1,
  nodes: 'not-an-array',
}

// Missing required property 'id' in a node
export const missingRequiredNodePropInstance = {
  workflowName: 'test',
  version: 1,
  nodes: [
    {
      label: 'Missing id',
      action: { type: 'manual', instructions: 'Fix this' },
    },
  ],
}

// Unknown property on a node
export const unknownNodePropertyInstance = {
  workflowName: 'test',
  version: 1,
  nodes: [
    {
      id: 'step1',
      label: 'Step 1',
      action: { type: 'manual', instructions: 'Do something' },
      extraProp: 'not-allowed',
    },
  ],
}

// Invalid discriminator (unknown action type)
export const invalidDiscriminatorInstance = {
  workflowName: 'test',
  version: 1,
  nodes: [
    {
      id: 'step1',
      label: 'Step 1',
      action: { type: 'unknown_action' },
    },
  ],
}

// Missing discriminator in action
export const missingDiscriminatorInstance = {
  workflowName: 'test',
  version: 1,
  nodes: [
    {
      id: 'step1',
      label: 'Step 1',
      action: {},
    },
  ],
}

// Omitted optional property 'tags' (structurally valid)
export const omittedTagsInstance = {
  workflowName: 'test',
  version: 1,
  nodes: [
    {
      id: 'step1',
      label: 'Step 1',
      action: {
        type: 'loop',
        iterator: 'i',
        maxIterations: 10,
      },
    },
  ],
}

// Explicit null for 'tags' (structurally invalid)
export const nullTagsInstance = {
  workflowName: 'test',
  version: 1,
  nodes: [
    {
      id: 'step1',
      label: 'Step 1',
      action: { type: 'manual', instructions: 'Do it' },
    },
  ],
  tags: null,
}

/**
 * Validator-coexistence fixture: Umpire validators alongside JSON Schema.
 */
export const validatorCoexistenceProfile: ProfileDocument = {
  $schema:
    'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
  profileVersion: 1,
  valueSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      email: { type: 'string' },
      count: { type: 'integer', minimum: 0 },
    },
    additionalProperties: false,
  },
  umpire: {
    version: 1,
    fields: {
      email: { isEmpty: 'string' },
      count: {},
    },
    rules: [],
    validators: {
      email: { op: 'email', error: 'Must be a valid email' },
    },
  },
}

/**
 * Simple profile for basic structural checks.
 */
export const simpleProfile: ProfileDocument = {
  $schema:
    'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
  profileVersion: 1,
  valueSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer', minimum: 0 },
    },
    required: ['name'],
    additionalProperties: false,
  },
  umpire: {
    version: 1,
    fields: {
      name: {},
      age: {},
    },
    rules: [],
  },
}

/**
 * Profile with unsupported keyword (should fail compilation).
 */
export const unsupportedKeywordProfile: Record<string, unknown> = {
  $schema:
    'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
  profileVersion: 1,
  valueSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      name: { type: 'string', format: 'email' },
    },
    additionalProperties: false,
  },
  umpire: {
    version: 1,
    fields: { name: {} },
    rules: [],
  },
}

/**
 * Profile with field/property mismatch (extra Umpire field).
 */
export const fieldMismatchProfile: Record<string, unknown> = {
  $schema:
    'https://spec.umpire.tools/profiles/json-schema/v1/profile.schema.json',
  profileVersion: 1,
  valueSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    additionalProperties: false,
  },
  umpire: {
    version: 1,
    fields: { name: {}, extraField: {} },
    rules: [],
  },
}
