# @umpire/reads

## 1.0.1

### Patch Changes

- b700196: Improve `createReads()` inference so unannotated read tables preserve boolean read keys for `fairWhenRead()` and `enabledWhenRead()`.
- c52a2e8: Propagate `fairWhenRead()` and `enabledWhenRead()` value-input field dependencies into Umpire graph edges.

  Read-backed rules now expose fields touched by their value-input reads as rule sources, so downstream graph consumers can observe upstream dependencies such as `country -> postalCode`. Self-dependencies are excluded, and condition-input or custom-selected reads remain conservative.

- Updated dependencies [7f036c2]
- Updated dependencies [102318e]
- Updated dependencies [c52a2e8]
  - @umpire/core@1.1.0

## 1.0.0

### Patch Changes

- fee01cf: code formatting & type adjustments for better consistency
- 4d8bd6c: adjusted publishing setup for `.claude` rules (i don't even honestly know if this kind of thing works. hopefully it's helpful!)
- 6060d47: Standardize error message prefixes to [@umpire/package] format for consistency and searchability across all packages.
- Updated dependencies [135e347]
- Updated dependencies [5b6ab7d]
- Updated dependencies [39be228]
- Updated dependencies [9bc562b]
- Updated dependencies [86280aa]
- Updated dependencies [fee01cf]
- Updated dependencies [82fdd4b]
- Updated dependencies [4eecbeb]
- Updated dependencies [4d8bd6c]
- Updated dependencies [7fb75bf]
- Updated dependencies [aad8d17]
- Updated dependencies [0904040]
- Updated dependencies [31bc71c]
- Updated dependencies [6060d47]
- Updated dependencies [17dea80]
- Updated dependencies [bff4c43]
- Updated dependencies [19fdbfe]
- Updated dependencies [8eaa826]
- Updated dependencies [17bd119]
  - @umpire/core@1.0.0

## 0.1.0-alpha.9

### Patch Changes

- Test expansion and coverage improvements

## 0.1.0-alpha.8

_Version skipped (internal)_

## 0.1.0-alpha.7

### Minor Changes

- Initial release: read-backed rule adapters
- `scorecard()` — structured summary of field state and active fouls
- Hint system: derive UI hints from coach/reads output
- Challenge trace attachments for read-backed rules
- Read-backed rule helpers: `coach`, `reads`, `markers`
