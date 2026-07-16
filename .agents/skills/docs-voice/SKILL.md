---
name: docs-voice
description: Voice, tone, and format for the public Layers docs (`apps/docs`, built with Blume). Use when authoring or editing apps/docs prose — landing, guides, concepts, adapters, reference — or deciding headline grammar, benefit framing, the experimental disclaimer wording, or overlay-vs-layer usage.
---

# Docs voice — Layers docs (`apps/docs`, built with Blume)

Keep landing, guides, concepts, adapters, and reference reading like one voice.

## Voice in one line

Senior-dev to senior-dev: concrete, API-literate, dry, honest about scope. No
hype. The differentiators are radical honesty (say what's planned / diverges /
was rejected) and the "when **not** to use it" anti-sell — keep both.

## Do

- **Lead with the pain, then the mechanism.** "Stop prop-drilling `isOpen`…" →
  then "open a layer from anywhere and `await` a typed result."
- **Concrete before abstract.** Name modals / drawers / toasts / confirms before
  the coinage "layer" / "overlay".
- **Section headers by page type.** Marketing = period-terminated benefit
  sentence ("Every adapter, the same API."); guides = action verb ("Configure
  serial scope"); reference = precise noun; concepts = model noun + consequence.
- **Card titles = the outcome; card bodies = the API.**
- **One idea per sentence in leads.** Short claim first, then expand.
- **Keep `// ^? type` twoslash hints and live demos** — proof, not decoration.
- **State experimental status once per surface, one wording** (see Canonical
  patterns).
- **Sidebar icons: all-or-none per sibling list.** Blume does not reserve an
  icon column — sparse `sidebar.icon` jaggeds labels and fakes hierarchy.
  Leaf icons only where every peer has a natural glyph (adapter/integration
  brand SVGs). Guides, Concepts, Examples, Reference leaves: none. Section
  `meta.ts` icons and tab icons stay. Nested brand groups (e.g. Svelte): icon
  on the group only — don't repeat the same SVG on indented children.
- **Adapter list order:** core/vanilla → react → preact → solid → angular →
  vue → svelte (runes → store). Every multi-adapter listing.

## Don't

- Don't open a page with a 60+ word sentence.
- Don't restate the frontmatter `description` in the first body sentence — the
  docs site renders `description` as the page subtitle, so an echoing opener
  duplicates content. Open with a concrete scenario/pain instead.
- Don't title cards with bare feature nouns ("Named stacks") when the outcome is
  the hook.
- Don't manufacture social proof, download counts, "trusted by", or maturity
  adjectives ("production-grade", "battle-tested", "world-class") at v0.1.0 —
  live demos, source, and the changelog are the proof.
- Don't call the core accessible / portal-aware / UI-complete — consumers own
  rendering, focus, portals, and a11y. Say "state coordination, not UI ownership".
- Don't hype ("blazing-fast", "revolutionary").
- Don't oscillate "layer" (the API unit) and "overlay" (the category) — see
  `apps/docs/content/concepts/glossary.mdx`.
- Don't invent Lucide icons for prose nav leaves to "fill out" a section —
  strip to none instead of decorating half the list.

## Canonical patterns (use verbatim)

- **Experimental disclaimer** (banner / pill / callout / stability page): "Experimental — the API may change between minor releases. Pin your version."
- **Pre-1.0 semver:** breaking changes are expected and ship in **minor releases** (`0.1` → `0.2`), **not majors**.
- **Brand one-liner** (memorable beat, not hype): "Modals are just async functions you forgot to `await`."
- **Overlay vs layer:** "overlay" = the UI category; "layer" = Layers' unit / API term.

## Verify

`content/**` MDX is excluded from oxfmt; `.astro` is not oxfmt-managed. Build
green before commit ([`verify-after-each-step`](../../rules/verify-after-each-step.md),
[`update-docs`](../update-docs/SKILL.md)).
