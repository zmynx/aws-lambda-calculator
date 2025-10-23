import { useEffect } from "react";
import type { Route } from "./+types/api-docs";
import FallingLambdas from "../components/FallingLambdas";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "API Documentation - AWS Lambda Calculator" },
    { name: "description", content: "API Documentation for AWS Lambda Calculator REST API" },
  ];
}

export default function ApiDocs() {
  useEffect(() => {
    // Load Swagger UI CSS
    const swaggerCss = document.createElement("link");
    swaggerCss.rel = "stylesheet";
    swaggerCss.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css";
    document.head.appendChild(swaggerCss);

    // Load Swagger UI Bundle
    const swaggerScript = document.createElement("script");
    swaggerScript.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js";
    swaggerScript.onload = () => {
      // Load Swagger UI Standalone Preset
      const presetScript = document.createElement("script");
      presetScript.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js";
      presetScript.onload = () => {
        // Initialize Swagger UI after scripts are loaded
        if ((window as any).SwaggerUIBundle) {
          (window as any).SwaggerUIBundle({
            url: `${window.location.origin}${window.location.pathname.includes('/aws-lambda-calculator') ? '/aws-lambda-calculator' : ''}/openapi.yaml`,
            dom_id: "#swagger-ui",
            deepLinking: true,
            presets: [
              (window as any).SwaggerUIBundle.presets.apis,
              (window as any).SwaggerUIStandalonePreset,
            ],
            plugins: [(window as any).SwaggerUIBundle.plugins.DownloadUrl],
            layout: "StandaloneLayout",
            tryItOutEnabled: true,
            defaultModelsExpandDepth: 1,
            defaultModelExpandDepth: 1,
            docExpansion: "list",
            filter: true,
            showRequestHeaders: true,
          });
        }
      };
      document.head.appendChild(presetScript);
    };
    document.head.appendChild(swaggerScript);

    // Cleanup function
    return () => {
      // Remove added scripts and styles when component unmounts
      const scripts = document.querySelectorAll('script[src*="swagger-ui"]');
      const styles = document.querySelectorAll('link[href*="swagger-ui"]');
      scripts.forEach(script => script.remove());
      styles.forEach(style => style.remove());
    };
  }, []);

  return (
    <div className="min-h-screen relative">
      <FallingLambdas />
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            API Documentation
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Interactive documentation for the AWS Lambda Calculator REST API
          </p>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Base URL:</strong> The API is available at multiple endpoints. Update the server dropdown below to select your preferred endpoint.
            </p>
          </div>
        </div>

        {/* Swagger UI Container */}
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/50 dark:border-slate-600">
          <div id="swagger-ui" className="swagger-container"></div>
        </div>

        {/* Additional Info Section */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/50 dark:border-slate-600 p-8">
            <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
              🔑 Authentication
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              The API is currently public and does not require authentication. Rate limiting is applied to prevent abuse.
            </p>
          </div>
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/50 dark:border-slate-600 p-8">
            <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
              📦 Response Format
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              All responses are returned in JSON format with appropriate HTTP status codes.
            </p>
          </div>
        </div>

        <div className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-yellow-800 dark:text-yellow-200">
            ⚡ Rate Limits
          </h2>
          <ul className="space-y-2 text-yellow-700 dark:text-yellow-300">
            <li>• 100 requests per second (burst: 200)</li>
            <li>• 100 requests per 5 minutes per IP address</li>
            <li>• Payload size limited to 10KB</li>
          </ul>
        </div>

      </div>
      
      {/* Custom styles for Swagger UI dark mode compatibility */}
      <style>{`
        .swagger-ui .topbar { display: none; }
        
        @media (prefers-color-scheme: dark) {
          #swagger-ui {
            filter: invert(0.9) hue-rotate(180deg);
          }
          #swagger-ui img {
            filter: invert(1) hue-rotate(180deg);
          }
        }
        
        .dark #swagger-ui {
          filter: invert(0.9) hue-rotate(180deg);
        }
        .dark #swagger-ui img {
          filter: invert(1) hue-rotate(180deg);
        }
      `}</style>
    </div>
  );
}
