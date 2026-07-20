import { defineConfig } from "blume";

import { CURATED_POPULAR } from "./components/curated-popular";

const title = "Layers";
/** Custom `.astro` pages have no frontmatter — name OG cards (else humanized segment). */
const homeTitle = `${title} — open any layer from anywhere`;
const notFoundTitle = "Page not found";

export default defineConfig({
  title,
  description:
    "Headless modal/dialog/drawer/popover/toast manager — open any layer from anywhere. Zero-dep core + React, Preact, Solid, Angular, Vue, Lit, Alpine, and Svelte adapters.",

  logo: { image: "/logo.svg", text: "Layers" },

  banner: {
    content:
      "Experimental — the API may change between minor releases. Pin your version.",
    link: { text: "Stability & versioning", href: "/concepts/stability" },
    dismissible: true,
    id: "experimental-2026",
  },

  github: {
    owner: "stainless-code",
    repo: "layers",
    branch: "main",
    dir: "apps/docs",
  },

  lastModified: true,

  content: {
    sources: [
      { type: "filesystem", root: "content" },
      {
        type: "github-releases",
        prefix: "changelog",
        owner: "stainless-code",
        repo: "layers",
        limit: 100,
      },
    ],
  },

  navigation: {
    tabs: [
      { label: "Guides", path: "/guides", icon: "book-open" },
      { label: "Examples", path: "/examples", icon: "rocket" },
      {
        label: "Integrations",
        path: "/integrations",
        icon: "blocks",
      },
      { label: "Concepts", path: "/concepts", icon: "layers" },
      { label: "Adapters", path: "/adapters", icon: "plug" },
      { label: "Reference", path: "/reference", icon: "code" },
    ],
    featured: [
      { label: "Changelog", href: "/changelog", icon: "sparkles" },
      {
        label: "GitHub",
        href: "https://github.com/stainless-code/layers",
        icon: "github",
      },
    ],
    sidebar: { display: "flat" },
  },

  theme: { accent: "teal", radius: "md", mode: "system" },
  search: {
    provider: "orama",
    popular: CURATED_POPULAR.map(({ route, label }) => ({
      href: route,
      label,
    })),
  },

  markdown: {
    code: { icons: true },
    codeBlocks: { theme: { light: "github-light", dark: "github-dark" } },
  },

  toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },

  export: { epub: true, pdf: true },

  ai: {
    llmsTxt: true,
    markdownComponents: {
      HeroDemo: () =>
        "_Live hero demo: interactive confirm, toast, serial queue, and nested-confirm scenarios running the real React adapter. See the page for the rendered demo._",
      ConfirmDialogExample: () =>
        "_Live demo: open a confirm dialog from anywhere and await a typed boolean result. See the page for the rendered demo and full source._",
      ToastExample: () =>
        "_Live demo: fire-and-forget toast that auto-dismisses. See the page for the rendered demo and full source._",
      ProgressExample: () =>
        "_Live demo: progress overlay with live payload updates. See the page for the rendered demo and full source._",
      DrawerExample: () =>
        "_Live demo: slide-over drawer that awaits a boolean result. See the page for the rendered demo and full source._",
      NestedConfirmExample: () =>
        "_Live demo: a parent dialog opening a child confirm via a layer group. See the page for the rendered demo and full source._",
      SerialOnboardingExample: () =>
        "_Live demo: a serial-scope onboarding queue (one active layer at a time). See the page for the rendered demo and full source._",
      RouteGuardExample: () =>
        "_Live demo: a module-level LayerClient opening a layer from non-UI code. See the page for the rendered demo and full source._",
      AnimatedEnterExitExample: () =>
        "_Live demo: enter/exit CSS transitions driven by the transition axis and call.settle(). See the page for the rendered demo and full source._",
      AsyncLoadFnExample: () =>
        "_Live demo: a layer that loads its data via loadFn — pending spinner, then resolved profile. See the page for the rendered demo and full source._",
      BlockersForceExample: () =>
        "_Live demo: a dirty-form blocker that vetoes dismissal, with a discard-confirm child and a force-close bypass. See the page for the rendered demo and full source._",
    },
  },

  seo: {
    og: {
      enabled: true,
      titles: { "/": homeTitle, "/404": notFoundTitle },
    },
    rss: { enabled: true, types: ["changelog"] },
    sitemap: true,
    robots: true,
    structuredData: true,
    agentReadability: true,
  },

  deployment: {
    output: "static",
    site: "https://stainless-code.com",
    base: "/layers",
  },
});
