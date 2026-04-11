---
"@umpire/core": minor
"@umpire/react": minor
---

Add browser/CDN builds via tsdown

Both `@umpire/core` and `@umpire/react` now ship bundled browser artifacts alongside the existing ESM build:

- `dist/index.browser.js` — minified ESM for `<script type="module">` and esm.sh
- `dist/index.iife.js` — IIFE with `window.Umpire` / `window.UmpireReact` globals

Both packages now expose a `browser` field and `"browser"` export condition pointing at the ESM build, so bundlers targeting browser environments resolve the right artifact automatically.

Unpkg / jsDelivr / esm.sh access is automatic — no extra configuration required after publish.
