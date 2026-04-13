---
"@umpire/json": patch
---

Ship the `conformance/` directory with the published package so external ports (Kotlin, Python, Dart, etc.) can consume the cross-runtime fixtures without cloning the repo. Adds `conformance/index.json` as a discovery manifest and a language-neutral pseudocode runner guide to `conformance/README.md`.
