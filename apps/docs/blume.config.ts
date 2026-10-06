import { defineConfig } from "blume";
import { orama } from "blume/search";
import { filesystem, githubReleases } from "blume/sources";

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

  github: {
    owner: "stainless-code",
    repo: "layers",
    branch: "main",
    dir: "apps/docs",
  },

  lastModified: "git",

  content: {
    sources: [
      filesystem({ root: "content" }),
      githubReleases({
        prefix: "changelog",
        owner: "stainless-code",
        repo: "layers",
        limit: 100,
      }),
    ],
  },

  navigation: {
    tabs: [
      { label: "Guides", path: "/guides" },
      { label: "Examples", path: "/examples" },
      {
        label: "Integrations",
        path: "/integrations",
      },
      { label: "Concepts", path: "/concepts" },
      { label: "Adapters", path: "/adapters" },
      { label: "Reference", path: "/reference" },
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

  footer: {
    links: [
      { label: "Getting started", href: "/guides/getting-started" },
      { label: "Core API", href: "/reference/core-api" },
      { label: "Changelog", href: "/changelog" },
    ],
    socials: {
      github: "https://github.com/stainless-code/layers",
    },
  },

  theme: { accent: "teal", radius: "md", mode: "system" },
  search: {
    provider: orama(),
    popular: CURATED_POPULAR.map(({ route, label }) => ({
      href: route,
      label,
    })),
  },

  markdown: {
    externalLinks: true,
    code: {
      icons: true,
      theme: { light: "github-light", dark: "github-dark" },
    },
  },

  variables: {
    "svelte-runes-min": "5.7+",
  },

  toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },

  export: { epub: true, pdf: true },

  agents: {
    llmsTxt: true,
    agentReadability: true,
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
  },

  deployment: {
    site: "https://stainless-code.com",
    base: "/layers",
  },
});
