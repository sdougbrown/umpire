# @umpire/vuex

- Use `fromVuexStore(ump, store, { select, conditions? })` to connect a Vuex store to Umpire.
- Vuex subscriptions do not provide previous state, so this adapter snapshots state before delegating to `@umpire/store`.
- Use `select()` to assemble the exact field values Umpire needs from the store state.
- Read availability through `field(name)`, `getAvailability()`, and `fouls`.
