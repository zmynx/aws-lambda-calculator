import type { Route } from "./+types/about";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About - AWS Lambda Calculator" },
    { name: "description", content: "About the AWS Lambda Calculator project" },
  ];
}

export default function About() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">About</h1>
      
      <div className="prose max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Project Overview</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The AWS Lambda Calculator is an open-source tool designed to help developers 
            and architects estimate costs for their serverless applications running on AWS Lambda.
          </p>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            This calculator provides accurate cost estimates based on current AWS pricing 
            and helps you optimize your Lambda functions for both performance and cost.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg transition-colors duration-300">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Cost Estimation</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Accurate pricing calculations</li>
                <li>Real-time cost updates</li>
                <li>Regional pricing differences</li>
              </ul>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg transition-colors duration-300">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Optimization</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                <li>Memory recommendations</li>
                <li>Performance analysis</li>
                <li>Cost comparison tools</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Technology Stack</h2>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg transition-colors duration-300">
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>React 19 with TypeScript</li>
              <li>React Router v7</li>
              <li>Tailwind CSS for styling</li>
              <li>Vite for build tooling</li>
              <li>AWS Lambda for backend API</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Contributing</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            We welcome contributions! Please see our contributing guidelines on GitHub 
            for information on how to get started.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg transition-colors duration-300">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This project is open source and available under the MIT License.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}