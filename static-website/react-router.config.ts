import type { Config } from "@react-router/dev/config";

export default {
  // Enable SPA mode for GitHub Pages deployment
  ssr: false,
  // Pre-render routes for better SEO and performance
  prerender: ["/", "/introduction", "/install-usage", "/configuration", "/getting-started", "/demo", "/about"],
} satisfies Config;
