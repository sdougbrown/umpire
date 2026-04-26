# @umpire/write

- Use this package for write-policy helpers that coordinate Umpire state updates.
- Keep helpers thin and composable; prefer adapters around `@umpire/core` over new state machinery.
- Do not imply persistence, validation, or database safety guarantees here.
