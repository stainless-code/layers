---
"@stainless-code/layers": minor
---

Serial stacks: failed `loadFn` occupies the lane by default (`onLoadError: "block"`); opt into `onLoadError: "advance"` to remove the failed layer and drain the queue.
