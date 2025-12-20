import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("introduction", "routes/introduction.tsx"),
  route("getting-started", "routes/getting-started.tsx"),
  route("configuration", "routes/configuration.tsx"),
  route("api-docs", "routes/api-docs.tsx"),
  route("comparison", "routes/comparison.tsx"),
  route("demo", "routes/demo.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
