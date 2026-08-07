import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { stageDirectoryReplacement } from '../../../scripts/lib/replace-directory.mjs'

const temporaryDirectories: string[] = []

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'umpire-fixture-sync-test-'),
  )
  temporaryDirectories.push(directory)
  return directory
}

function fixtureTree() {
  const root = temporaryDirectory()
  const sourceDir = path.join(root, 'source')
  const targetDir = path.join(root, 'conformance')
  fs.mkdirSync(path.join(sourceDir, 'fixtures'), { recursive: true })
  fs.writeFileSync(
    path.join(sourceDir, 'fixtures', 'new.json'),
    '{"new":true}\n',
  )
  fs.mkdirSync(targetDir)
  fs.writeFileSync(path.join(targetDir, 'old.json'), '{"old":true}\n')
  return { root, sourceDir, targetDir }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('fixture directory replacement', () => {
  test('installs a complete staged tree and marker', () => {
    const { root, sourceDir, targetDir } = fixtureTree()

    stageDirectoryReplacement({
      sourceDir,
      targetDir,
      markerContents: '{"version":"v1.0.1"}\n',
    })

    expect(fs.existsSync(path.join(targetDir, 'old.json'))).toBe(false)
    expect(
      fs.readFileSync(path.join(targetDir, 'fixtures', 'new.json'), 'utf8'),
    ).toBe('{"new":true}\n')
    expect(
      fs.readFileSync(path.join(targetDir, '.synced-at-version'), 'utf8'),
    ).toBe('{"version":"v1.0.1"}\n')
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.backup-')),
    ).toEqual([])
  })

  test('leaves the current tree untouched when staging fails', () => {
    const { root, sourceDir, targetDir } = fixtureTree()

    expect(() =>
      stageDirectoryReplacement({
        sourceDir,
        targetDir,
        markerContents: '{}\n',
        operations: {
          copyFileSync() {
            throw new Error('copy failed')
          },
        },
      }),
    ).toThrow('copy failed')

    expect(fs.readFileSync(path.join(targetDir, 'old.json'), 'utf8')).toBe(
      '{"old":true}\n',
    )
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.staging-')),
    ).toEqual([])
  })

  test('leaves the current tree untouched when writing the marker fails', () => {
    const { root, sourceDir, targetDir } = fixtureTree()

    expect(() =>
      stageDirectoryReplacement({
        sourceDir,
        targetDir,
        markerContents: '{}\n',
        operations: {
          writeFileSync() {
            throw new Error('marker failed')
          },
        },
      }),
    ).toThrow('marker failed')

    expect(fs.readFileSync(path.join(targetDir, 'old.json'), 'utf8')).toBe(
      '{"old":true}\n',
    )
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.staging-')),
    ).toEqual([])
  })

  test('restores the current tree when installing the staged tree fails', () => {
    const { root, sourceDir, targetDir } = fixtureTree()

    expect(() =>
      stageDirectoryReplacement({
        sourceDir,
        targetDir,
        markerContents: '{}\n',
        operations: {
          renameSync(source, target) {
            if (source.includes('.staging-')) throw new Error('install failed')
            fs.renameSync(source, target)
          },
        },
      }),
    ).toThrow('install failed')

    expect(fs.readFileSync(path.join(targetDir, 'old.json'), 'utf8')).toBe(
      '{"old":true}\n',
    )
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.backup-')),
    ).toEqual([])
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.staging-')),
    ).toEqual([])
  })

  test('preserves the backup and reports both errors when rollback fails', () => {
    const { root, sourceDir, targetDir } = fixtureTree()
    let thrown: unknown

    try {
      stageDirectoryReplacement({
        sourceDir,
        targetDir,
        markerContents: '{}\n',
        operations: {
          renameSync(source, target) {
            if (source.includes('.staging-')) throw new Error('install failed')
            if (source.includes('.backup-')) throw new Error('rollback failed')
            fs.renameSync(source, target)
          },
        },
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(AggregateError)
    expect((thrown as AggregateError).errors).toHaveLength(2)
    expect(fs.existsSync(targetDir)).toBe(false)
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.backup-')),
    ).toHaveLength(1)
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.staging-')),
    ).toEqual([])
  })

  test('reports backup cleanup failures after installing the new tree', () => {
    const { root, sourceDir, targetDir } = fixtureTree()

    expect(() =>
      stageDirectoryReplacement({
        sourceDir,
        targetDir,
        markerContents: '{}\n',
        operations: {
          rmSync(target, options) {
            if (target.includes('.backup-')) throw new Error('cleanup failed')
            fs.rmSync(target, options)
          },
        },
      }),
    ).toThrow('cleanup failed')

    expect(
      fs.readFileSync(path.join(targetDir, 'fixtures', 'new.json'), 'utf8'),
    ).toBe('{"new":true}\n')
    expect(
      fs.readdirSync(root).filter((name) => name.includes('.backup-')),
    ).toHaveLength(1)
  })
})
