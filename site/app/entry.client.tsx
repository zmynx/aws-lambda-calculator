import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';

// Import your route components
import Home from "./routes/home";
import Introduction from "./routes/introduction";
import InstallUsage from "./routes/install-usage";
import Configuration from "./routes/configuration";
import GettingStarted from "./routes/getting-started";
import ApiDocs from "./routes/api-docs";
import Comparison from "./routes/comparison";
import Demo from "./routes/demo";
import About from "./routes/about";

// Import layout components
import Navbar from "./components/Navbar";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RenderMounted } from "./components/ClientRender";

// CSS
import "./app.css";

// Root layout component
function RootLayout() {
  return (
    <RenderMounted>
      <ThemeProvider>
        <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-slate-950">
          <Navbar />
          <Outlet />
        </div>
      </ThemeProvider>
    </RenderMounted>
  );
}

// Create hash router with nested routes
const router = createHashRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "introduction",
        element: <Introduction />,
      },
      {
        path: "install-usage", 
        element: <InstallUsage />,
      },
      {
        path: "configuration",
        element: <Configuration />,
      },
      {
        path: "getting-started",
        element: <GettingStarted />,
      },
      {
        path: "api-docs",
        element: <ApiDocs />,
      },
      {
        path: "comparison",
        element: <Comparison />,
      },
      {
        path: "demo",
        element: <Demo />,
      },
      {
        path: "about",
        element: <About />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);