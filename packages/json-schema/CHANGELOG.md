# @umpire/json-schema

## 0.1.0

### Minor Changes

- 7df3778: Release `@umpire/json-schema` 0.1.0, the JSON Schema composition profile. Adds `compileProfile()`, `compileSchemas()`, `CompiledProfile` with separate `check()`/`validateStructure()`/`evaluate()` APIs, and `filterStructuralIssues()` UI helper. Structural validation uses AJV 2020-12, conforms to `umpire-spec` v1.1.0, and remains independent of Umpire availability evaluation.

### Patch Changes

- Updated dependencies [705c8c4]
  - @umpire/json@1.0.2
