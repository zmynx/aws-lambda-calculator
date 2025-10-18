import type { Route } from "./+types/about";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About - AWS Lambda Calculator" },
    { name: "description", content: "About the AWS Lambda Calculator project - An open-source serverless cost estimation tool" },
  ];
}

export default function About() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-slate-900 dark:text-slate-100 tracking-tight">About AWS Lambda Calculator</h1>
      
      <div className="prose max-w-none">
        {/* Hero Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-8 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors duration-300">
            <h2 className="text-3xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Open-Source Serverless Cost Calculator</h2>
            <p className="text-lg text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
              The AWS Lambda Calculator is a comprehensive, open-source tool designed to help developers, architects, and DevOps engineers 
              accurately estimate costs for their serverless applications running on AWS Lambda. Built with precision and flexibility in mind, 
              it provides detailed cost breakdowns across all AWS regions and architectures.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">36 AWS Regions</span>
              </div>
              <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <span className="text-green-600 dark:text-green-400 font-semibold">x86 & ARM64 Support</span>
              </div>
              <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <span className="text-purple-600 dark:text-purple-400 font-semibold">Free Tier Aware</span>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-8 text-slate-900 dark:text-slate-100">🚀 Key Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <div className="text-3xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Precise Cost Calculation</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                <li>• Real-time AWS pricing data</li>
                <li>• Tiered pricing support</li>
                <li>• Free tier calculations</li>
                <li>• Ephemeral storage costs</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <div className="text-3xl mb-4">🌍</div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Global Coverage</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                <li>• All 36 AWS regions supported</li>
                <li>• Regional pricing variations</li>
                <li>• AWS GovCloud included</li>
                <li>• Latest region additions</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Architecture Support</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                <li>• x86_64 compatibility</li>
                <li>• ARM64 (Graviton2) support</li>
                <li>• ~20% ARM64 cost savings</li>
                <li>• Architecture comparison</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <div className="text-3xl mb-4">🔧</div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Multiple Interfaces</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                <li>• Python package (pip install)</li>
                <li>• REST API endpoint</li>
                <li>• Command-line interface</li>
                <li>• Interactive web app</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Detailed Breakdown</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                <li>• Step-by-step calculations</li>
                <li>• Request vs duration costs</li>
                <li>• Free tier impact analysis</li>
                <li>• Verbose logging options</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Flexible Units</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                <li>• Per second to per month</li>
                <li>• MB and GB memory units</li>
                <li>• Configurable time periods</li>
                <li>• Custom request volumes</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Architecture & Components */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-8 text-slate-900 dark:text-slate-100">🏗️ Architecture & Components</h2>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Core Calculator Engine</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>• <strong>Python 3.13+</strong> - Core calculation logic</li>
                <li>• <strong>Pydantic</strong> - Data validation & serialization</li>
                <li>• <strong>Poetry</strong> - Dependency management</li>
                <li>• <strong>JSON pricing data</strong> - Region-specific costs</li>
                <li>• <strong>Tiered pricing logic</strong> - Complex billing rules</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Web Frontend</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>• <strong>React 19</strong> - Modern UI framework</li>
                <li>• <strong>TypeScript</strong> - Type-safe development</li>
                <li>• <strong>React Router v7</strong> - Client-side routing</li>
                <li>• <strong>Tailwind CSS v4</strong> - Utility-first styling</li>
                <li>• <strong>Vite</strong> - Fast build tooling</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Serverless API</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>• <strong>AWS Lambda</strong> - Serverless compute</li>
                <li>• <strong>API Gateway</strong> - REST API endpoints</li>
                <li>• <strong>CloudFormation/CDK</strong> - Infrastructure as Code</li>
                <li>• <strong>CORS enabled</strong> - Cross-origin support</li>
                <li>• <strong>JSON responses</strong> - Structured output</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Development Tools</h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>• <strong>Nix Flakes</strong> - Reproducible dev environment</li>
                <li>• <strong>Just</strong> - Command runner</li>
                <li>• <strong>pytest</strong> - Testing framework</li>
                <li>• <strong>Ruff</strong> - Fast Python linter</li>
                <li>• <strong>mypy</strong> - Static type checking</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Project Statistics */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-8 text-slate-900 dark:text-slate-100">📈 Project Statistics</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">36</div>
              <div className="text-slate-700 dark:text-slate-300 font-medium">AWS Regions</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supported worldwide</div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">2</div>
              <div className="text-slate-700 dark:text-slate-300 font-medium">Architectures</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">x86_64 & ARM64</div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">4</div>
              <div className="text-slate-700 dark:text-slate-300 font-medium">Access Methods</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Python, API, CLI, Web</div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">100%</div>
              <div className="text-slate-700 dark:text-slate-300 font-medium">Open Source</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Apache 2.0 License</div>
            </div>
          </div>
        </section>

        {/* Team & Contact */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-8 text-slate-900 dark:text-slate-100">👥 Team & Contact</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Project Authors</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    LD
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Lior Dux</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Author & Lead Developer</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">lior.dux@develeap.com</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                    AM
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Alex Machulsky</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Maintainer</div>
                    <div className="text-xs text-green-600 dark:text-green-400">alexm051197@gmail.org</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Get Involved</h3>
              <div className="space-y-3">
                <a href="https://github.com/zmynx/aws-lambda-calculator" 
                   className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-all duration-200 border border-slate-200 dark:border-slate-700">
                  <span className="text-2xl">🐙</span>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">GitHub Repository</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Source code, issues, and contributions</div>
                  </div>
                </a>
                
                <a href="https://github.com/zmynx/aws-lambda-calculator/releases" 
                   className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md transition-all duration-200 border border-slate-200 dark:border-slate-700">
                  <span className="text-2xl">📦</span>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Latest Releases</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Download packages and view changelog</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* License & Contributing */}
        <section className="mb-8">
          <h2 className="text-3xl font-semibold mb-8 text-slate-900 dark:text-slate-100">🤝 Contributing & License</h2>
          
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 p-8 rounded-xl border border-green-200 dark:border-green-800">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">🚀 How to Contribute</h3>
                <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                  <li>• Fork the repository on GitHub</li>
                  <li>• Create a feature branch for your changes</li>
                  <li>• Follow the coding standards and add tests</li>
                  <li>• Submit a pull request with clear description</li>
                  <li>• Join discussions in GitHub issues</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">📄 Open Source License</h3>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⚖️</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Apache License 2.0</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    This project is open source and available under the Apache 2.0 License. 
                    You're free to use, modify, and distribute this software according to the license terms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}