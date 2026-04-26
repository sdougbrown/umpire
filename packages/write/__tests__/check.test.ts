import { expect, test } from 'bun:test'

import { checkCreate, checkPatch } from '@umpire/write'

test('exports callable write scaffold helpers', () => {
  expect(checkCreate()).toBe(true)
  expect(checkPatch()).toBe(true)
})
