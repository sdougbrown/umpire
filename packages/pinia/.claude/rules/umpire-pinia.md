# @umpire/pinia

- Use `fromPiniaStore(ump, store, { select, conditions? })` to connect a Pinia store to Umpire.
- Pinia subscriptions do not provide previous state, so this adapter snapshots a shallow copy of `store.$state` before delegating to `@umpire/store`.
- Use `select()` to assemble the exact field values Umpire needs from the store state.
- Read availability through `field(name)`, `getAvailability()`, and `fouls`.
