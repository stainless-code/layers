import { defineComponents } from "blume";

import Pagination from "./components/blume/Pagination.astro";
import Search from "./components/blume/Search.astro";
import RecipeCodeBlock from "./components/RecipeCodeBlock.astro";

export default defineComponents({
  mdx: {
    // Cap long recipe code blocks with an inner vertical scroll (copy button
    // stays fixed — the <pre> is static, only the <code> scrolls). Wide
    // markdown tables are wrapped natively by blume's `blume:table-wrap` hast
    // plugin (`.blume-table-scroll`), so no table override is needed here.
    CodeBlock: RecipeCodeBlock,
  },
  layout: {
    // Use the theme radius token (rounded-blume) instead of the built-in pills
    // (rounded-full) — softer corners that match the table/install cards.
    Pagination,
    Search,
  },
});
