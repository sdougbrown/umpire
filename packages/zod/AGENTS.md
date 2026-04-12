# @umpire/zod

- Use `deriveSchema(availability, fieldSchemas)` with a field-schema shape, not a `z.object()` instance.
- Disabled fields are excluded from the derived schema. Enabled but optional fields get `.optional()`.
- Normalize parse issues with `zodErrors(error)`, then filter them with `deriveErrors(availability, errors)`.
- This package is availability-aware validation glue; keep availability logic in `@umpire/core`, not inside Zod refinements.
