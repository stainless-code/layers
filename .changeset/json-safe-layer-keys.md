---
"@stainless-code/layers": patch
---

Reject non-JSON-safe layer key segments with `LayerKeyError` before `hashKey`. Previously `JSON.stringify` could collide `[undefined]` / `[null]` / `[NaN]` as `"[null]"`.
