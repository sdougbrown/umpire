---
"@umpire/core": minor
---

- Add `eitherOf(groupName, branches)`, a new core rule helper for named OR paths where each branch is a group of ANDed rules.
- `eitherOf()` supports both availability and fairness constraints, validates that inner rules share the same targets and constraint, and allows multiple branches to pass at once.
- `challenge()` and `inspectRule()` now preserve `eitherOf()` branch structure so named paths are visible in debugging output.
