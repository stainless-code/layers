---
"@stainless-code/layers": patch
---

Serial stacks: failed `loadFn` occupies the lane by default (`onLoadError: "block"`), fixing leapfrog where a later open could mount while an error layer stayed up. Opt into `onLoadError: "advance"` to remove the failed layer and drain the queue.
