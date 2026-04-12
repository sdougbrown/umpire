---
"@umpire/zod": minor
---

- Rename `activeSchema()` to `deriveSchema()` for clearer naming consistency with the rest of the `@umpire/zod` surface.
- Rename `activeErrors()` to `deriveErrors()`.
- Rename `createZodValidation()` to `createZodAdapter()`, matching the existing adapter-oriented type naming.
- Rename the exported adapter types to `CreateZodAdapterOptions`, `ZodAdapter`, and `ZodAdapterRunResult`.
- Update the `@umpire/zod` docs, examples, and devtools copy to use the new derived-schema terminology consistently.
