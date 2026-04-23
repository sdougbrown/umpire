# @umpire/testing

## monkeyTest

- Use `monkeyTest(ump, options?)` in tests and assert on the returned `passed` flag or `violations`.
- Configs with 6 or fewer fields are tested exhaustively; larger configs are sampled with a seeded PRNG.
- Pass representative `conditions` snapshots when rules depend on external context.
- Violations are structural invariant failures, not user-facing validation errors.

## checkAssert

- Use `checkAssert(ump.check(values))` for readable scenario-level assertions on field availability.
- Methods: `.enabled()`, `.disabled()`, `.fair()`, `.foul()`, `.required()`, `.optional()`, `.satisfied()`, `.unsatisfied()`.
- All methods accept variadic field names and return the chain for further assertions.
- Disabled fields always have `fair: true`; `.foul()` therefore only fires for enabled fields with invalid values.
- Throws `Error` with a descriptive message listing all failing fields — compatible with any test framework.
