# Prefer wired handles in adapter headlines

**Decision:** Adapter Confirm heroes, home Batteries copy, and skill fire-and-forget examples teach the **Drive** surface (`useLayer` / `injectLayer` / `createLayer` → `.open(payload)`). Bag-form `client.open({ …layerOptions, payload })` stays a first-class escape hatch ([migration](../../apps/docs/content/reference/migration.mdx)) — core guides and dynamic-key demos keep it.

**Shipped:** those headlines now match home `adapter-snippets` / package README taste.

**Deferred:** guides that lead with bag-form then mention handles (`awaiting-results`, `error-handling`, `payload-validation`, `singletons`, concepts). Flip only if we want Drive-first pedagogy site-wide — not required for escape-hatch honesty.
