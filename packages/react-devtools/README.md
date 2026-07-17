# @stainless-code/react-layers-devtools

React doorbell for `@stainless-code/layers-devtools` — one plugin line into `<TanStackDevtools />`.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add -d @stainless-code/react-layers-devtools @tanstack/react-devtools`

**Peers:** `react` (^18 or ^19), `@stainless-code/react-layers`, `@tanstack/react-devtools`

## Taste

Gate the shell (it does not self-hide) — details in the [Devtools guide](https://stainless-code.com/layers/guides/devtools).

```tsx
import { StackProvider, StackOutlet } from "@stainless-code/react-layers";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { layersDevtoolsPlugin } from "@stainless-code/react-layers-devtools";

function App() {
  return (
    <StackProvider>
      <AppRoutes />
      <StackOutlet />
      {import.meta.env.DEV && (
        <TanStackDevtools plugins={[layersDevtoolsPlugin()]} />
      )}
    </StackProvider>
  );
}
```

## Docs

- [Devtools guide](https://stainless-code.com/layers/guides/devtools)
- [React adapter](https://stainless-code.com/layers/adapters/react)
- [Full docs](https://stainless-code.com/layers)

[Source on GitHub](https://github.com/stainless-code/layers/tree/main/packages/react-devtools)
