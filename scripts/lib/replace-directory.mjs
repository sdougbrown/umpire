import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const defaultOperations = {
  copyFileSync: fs.copyFileSync,
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  readdirSync: fs.readdirSync,
  renameSync: fs.renameSync,
  rmSync: fs.rmSync,
  writeFileSync: fs.writeFileSync,
}

function copyRecursive(sourceDir, targetDir, operations) {
  const dirents = operations.readdirSync(sourceDir, { withFileTypes: true })
  for (const dirent of dirents) {
    if (dirent.name === '.synced-at-version') continue

    const sourcePath = path.join(sourceDir, dirent.name)
    const targetPath = path.join(targetDir, dirent.name)
    if (dirent.isDirectory()) {
      operations.mkdirSync(targetPath, { recursive: true })
      copyRecursive(sourcePath, targetPath, operations)
    } else if (dirent.isFile()) {
      operations.copyFileSync(sourcePath, targetPath)
    } else {
      throw new Error(`Unsupported fixture entry: ${sourcePath}`)
    }
  }
}

function uniqueSibling(targetDir, kind) {
  return path.join(
    path.dirname(targetDir),
    `.${path.basename(targetDir)}.${kind}-${crypto.randomUUID()}`,
  )
}

export function stageDirectoryReplacement({
  sourceDir,
  targetDir,
  markerContents,
  operations: operationOverrides = {},
}) {
  const operations = { ...defaultOperations, ...operationOverrides }
  const stagedDir = uniqueSibling(targetDir, 'staging')
  const backupDir = uniqueSibling(targetDir, 'backup')
  let previousTargetWasMoved = false
  let replacementWasInstalled = false

  try {
    operations.mkdirSync(stagedDir)
    copyRecursive(sourceDir, stagedDir, operations)
    operations.writeFileSync(
      path.join(stagedDir, '.synced-at-version'),
      markerContents,
      'utf8',
    )

    if (operations.existsSync(targetDir)) {
      operations.renameSync(targetDir, backupDir)
      previousTargetWasMoved = true
    }

    try {
      operations.renameSync(stagedDir, targetDir)
      replacementWasInstalled = true
    } catch (installError) {
      if (previousTargetWasMoved && !operations.existsSync(targetDir)) {
        try {
          operations.renameSync(backupDir, targetDir)
          previousTargetWasMoved = false
        } catch (rollbackError) {
          throw new AggregateError(
            [installError, rollbackError],
            `Failed to install fixtures and restore ${targetDir}; backup remains at ${backupDir}`,
          )
        }
      }
      throw installError
    }

    if (previousTargetWasMoved) {
      // Cleanup is part of a successful sync; report failures rather than silently leaving stale fixture backups.
      operations.rmSync(backupDir, { recursive: true, force: true })
      previousTargetWasMoved = false
    }
  } finally {
    if (!replacementWasInstalled && operations.existsSync(stagedDir)) {
      operations.rmSync(stagedDir, { recursive: true, force: true })
    }
  }
}
