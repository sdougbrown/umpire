# @umpire/json-schema

JSON Schema composition profile for `@umpire/core`.

- Use `compileProfile(raw)` or `compileSchemas({ valueSchema, umpire })` to parse and validate a profile document.
- Use the returned `CompiledProfile.check()`, `.validateStructure()`, and `.evaluate()` to obtain separate availability and structural results.
- Use `filterStructuralIssues(availability, issues)` for UI consumers that want to suppress issues for disabled fields.
- The package adds AJV 8 (2020-12) for JSON Schema validation. `@umpire/core` and `@umpire/json` have **no** JSON Schema dependency.
- Structural issues are never merged into `FieldStatus.valid` or `error`. The two authority outputs remain separate.
- Unsupported JSON Schema keywords fail profile compilation rather than degrading silently.
