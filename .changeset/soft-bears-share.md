---
"@umpire/json": minor
---

- Add portable JSON schema support for `eitherOf()` via `{ type: "eitherOf", group, branches }`.
- Add `eitherOfJson(groupName, branches)` and expose it through `createJsonRules()` for JSON-authored named OR paths.
- `fromJson()`, `toJson()`, and `validateSchema()` now understand `eitherOf()` and preserve the same branch-shape invariants as core.
- Add conformance coverage for `eitherOf()` auth-path flows in the JSON fixture suite.
