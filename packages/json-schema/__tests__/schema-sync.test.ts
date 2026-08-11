import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'bun:test'

import { PROFILE_META_SCHEMA } from '../src/profile-meta.js'

const schemaDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../schemas',
)

describe('vendored profile meta-schema sync', () => {
  test('inline PROFILE_META_SCHEMA matches the shipped schemas file', () => {
    const vendored = JSON.parse(
      readFileSync(path.join(schemaDir, 'profile.schema.json'), 'utf8'),
    )
    expect(PROFILE_META_SCHEMA).toEqual(vendored)
  })
})
