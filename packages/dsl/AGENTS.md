# @umpire/dsl

- This package owns the pure expression vocabulary (`Expr`) and non-`check` `expr.*` builders.
- `compileExpr()` and `getExprFieldRefs()` here are non-JSON only; no validator specs or `expr.check()`.
- Keep this package runtime-light and focused on plain expression data + compilation.
