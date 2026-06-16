# @umpire/drizzle

## 1.0.0-rc.2

### Minor Changes

- 7f036c2: Add async write-policy helpers and async Drizzle policy helpers for use with `@umpire/async`.

### Patch Changes

- 4ce437f: Add `@umpire/drizzle` as an RC adapter for deriving Umpire write policies from Drizzle ORM 1.0 table metadata.

  The adapter includes:
  - `fromDrizzleTable(table, options?)`, which derives Umpire field definitions from Drizzle columns using Drizzle's public `getColumns()` helper.
  - `fromDrizzleModel(model)`, which composes multiple tables into one namespaced flat Umpire policy surface with typed `name(namespace, field)` and `field(namespace, field)` helpers.
  - Drizzle-aware write checks: `checkDrizzleCreate`, `checkDrizzlePatch`, `checkDrizzleModelCreate`, and `checkDrizzleModelPatch`.
  - Policy builders: `createDrizzlePolicy` and `createDrizzleModelPolicy`, which combine derived fields, handwritten rules, key handling options, and optional schema validation adapters.
  - Structured write result types: `DrizzleWriteResult`, `DrizzleModelWriteResult`, `DrizzleWriteOptions`, and `DrizzleColumnIssue`.

  Column handling excludes primary keys and generated columns by default. Static primitive defaults are copied into Umpire field defaults; SQL and runtime defaults make fields optional without copying storage-layer behavior. Create and patch helpers shape accepted write payloads for Drizzle, reject or strip unknown/non-writable keys, filter disabled submitted fields from persistence data, and include stale-value clears when patch rules disable previously populated fields.

  Validation adapter composition uses `WriteValidationAdapter` and `WriteComposedResult` from `@umpire/write`, so Drizzle column issues, Umpire rule issues, and schema validation issues are reported under structured issue buckets such as `issues.columns`, `issues.rules`, and `issues.schema`.

- Updated dependencies [7f036c2]
- Updated dependencies [7f036c2]
- Updated dependencies [7f036c2]
- Updated dependencies [102318e]
- Updated dependencies [c52a2e8]
  - @umpire/async@1.0.0
  - @umpire/core@1.1.0
  - @umpire/write@1.2.0
