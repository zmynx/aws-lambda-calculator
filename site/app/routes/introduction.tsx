import type { Route } from "./+types/introduction";
import FallingLambdas from "../components/FallingLambdas";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Introduction - AWS Lambda Calculator" },
    { name: "description", content: "Learn about AWS Lambda and cost calculation" },
  ];
}

export default function Introduction() {
  return (
    <div className="min-h-screen relative">
      <FallingLambdas />
      <div className="container mx-auto p-8 relative z-10">
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">Introduction</h1>
      
      <div className="prose max-w-none">
        <section className="mb-8" id="back-story">
          <h2 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-gray-100">📖 Back story</h2>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg transition-colors duration-300">
            <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
              This project is the fruits of a hackathon idea I had about a year ago, which was to provide users with a system to decide whether to go with the lambda serverless solution, 
              or follow the more scalable kubernetes based solutions. To do that, I needed a cost estimation for both solutions 
              using the same configurations.
              <br/><br/>
              <strong>I couldn't find a single calculator to support all configuration range values. So I've decided to create my own clone of the original calculator provided by AWS.</strong>
              <br/><br/>
              I ended up making this project my go-to for curiosities I've had regarding operations, tooling and anything DevOps related. And of course it's been a blast!
              As an enthusiast of FOSS projects, I wanted to share it with the community so others can benefit from it as well.
              Hope you find it useful! Enjoy!
            </p>
          </div>
        </section>

        <section className="mb-8" id="the-short-version">
          <h2 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-gray-100">⚡ The short version...</h2>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 dark:border-yellow-400 p-4 mb-6 transition-colors duration-300">
            <blockquote className="text-lg font-medium text-gray-800 dark:text-gray-200">
              "Today's calculators are too limited. Try to calculate a 10GB memory-use Lambda function, or estimate a real production workload. You simply can't."
            </blockquote>
          </div>

          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl p-8 border border-slate-200/50 dark:border-slate-600 transition-colors duration-300">
            <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
              Born as a result of a need to have a near accurate cost estimation for Lambda functions on the AWS cloud. 
              While doing some research I've discovered the following:
            </p>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full font-bold text-sm">
                    1
                  </span>
                </div>
                <div className="ml-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>Limited calculators:</strong> The available calculators are limited, and do NOT allow for the wide range 
                    of configurations Lambda offers today.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full font-bold text-sm">
                    2
                  </span>
                </div>
                <div className="ml-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>No API available:</strong> There is no API available (as-of-today) to allow to scripted / non-web based invocations. 
                    This seriously reduces the chances of such calculators to be part of a FinOps tool / platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Additional Context */}
        <section className="mb-8">
          <h2 className="text-3xl font-semibold mb-4 text-gray-900 dark:text-gray-100">🎯 Our Solution</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg transition-colors duration-300">
              <h3 className="text-xl font-semibold mb-3 text-green-800 dark:text-green-300">✅ What We Provide</h3>
              <ul className="space-y-2 text-green-700 dark:text-green-400">
                <li>• Support for full Lambda configuration range (128MB - 10GB)</li>
                <li>• API-first approach for automation</li>
                <li>• Multiple deployment options</li>
                <li>• Accurate cost calculations</li>
                <li>• Open source and customizable</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg transition-colors duration-300">
              <h3 className="text-xl font-semibold mb-3 text-blue-800 dark:text-blue-300">🚀 Use Cases</h3>
              <ul className="space-y-2 text-blue-700 dark:text-blue-400">
                <li>• FinOps cost analysis</li>
                <li>• Architecture decision making</li>
                <li>• Budget planning</li>
                <li>• Performance optimization</li>
                <li>• Serverless vs Container comparison</li>
              </ul>
            </div>
          </div>
        </section>

      </div>
    </div>
    </div>
  );
}
