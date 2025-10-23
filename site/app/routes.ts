import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("introduction", "routes/introduction.tsx"),
  route("install-usage", "routes/install-usage.tsx"),
  route("configuration", "routes/configuration.tsx"),
  route("getting-started", "routes/getting-started.tsx"),
  route("api-docs", "routes/api-docs.tsx"),
  route("comparison", "routes/comparison.tsx"),
  route("demo", "routes/demo.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
