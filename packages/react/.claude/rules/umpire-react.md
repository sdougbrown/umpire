# @umpire/react

- Use `useUmpire(ump, values, conditions?)` to derive availability inside React components.
- The hook returns `{ check, fouls }`.
- Do not use `useEffect` to react to availability changes; availability is derived each render.
- `check` is a plain `AvailabilityMap` object. Read fields like `check.fieldName.enabled`.
- `fouls` come from `ump.play()` comparing the current render snapshot to the previous one.
- Previous-snapshot tracking is handled internally by the hook with `useRef`.
