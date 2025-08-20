import type { Route } from "./+types/getting-started";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Getting Started - AWS Lambda Calculator" },
    { name: "description", content: "Quick start guide for the AWS Lambda Calculator" },
  ];
}

export default function GettingStarted() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">Getting Started</h1>
      
      <div className="prose max-w-none">
        {/* Introduction */}
        <div className="mb-8 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Get up and running with the AWS Lambda Calculator in just a few minutes!
          </p>
        </div>

        {/* Quick Start Steps */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-gray-900 dark:text-gray-100">🚀 Quick Start (2 minutes)</h2>
          
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-500 text-white rounded-full font-bold">
                  1
                </span>
              </div>
              <div className="ml-6 flex-grow">
                <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">🌐 Try the Web Calculator</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    The fastest way to get started is using our web-based calculator. No installation required!
                  </p>
                  <a 
                    href="/demo" 
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
                  >
                    🧮 Open Calculator
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-10 h-10 bg-green-500 text-white rounded-full font-bold">
                  2
                </span>
              </div>
              <div className="ml-6 flex-grow">
                <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">📝 Enter Your Lambda Parameters</h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Input your function's configuration:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                      <li>• <strong>Memory:</strong> 128 MB - 10 GB</li>
                      <li>• <strong>Duration:</strong> Average execution time</li>
                    </ul>
                    <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                      <li>• <strong>Requests:</strong> Monthly invocations</li>
                      <li>• <strong>Region:</strong> AWS region</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-10 h-10 bg-purple-500 text-white rounded-full font-bold">
                  3
                </span>
              </div>
              <div className="ml-6 flex-grow">
                <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
                  <h3 className="text-xl font-semibold mb-3">📊 Get Your Cost Estimate</h3>
                  <p className="text-gray-700 mb-4">
                    Click "Calculate" to receive a detailed breakdown of your estimated Lambda costs including:
                  </p>
                  <ul className="space-y-1 text-gray-700">
                    <li>• Request charges</li>
                    <li>• Duration-based charges (GB-seconds)</li>
                    <li>• Total monthly estimate</li>
                    <li>• Free tier considerations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Example Walkthrough */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">🎯 Example Walkthrough</h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-yellow-800">
              📚 Scenario: Web API Backend
            </h3>
            <p className="text-yellow-700 mb-4">
              Let's calculate costs for a typical web API Lambda function:
            </p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/80 dark:bg-gray-800 p-4 rounded-lg shadow transition-colors duration-300">
                <h4 className="font-semibold mb-3">📋 Function Requirements</h4>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>Memory:</strong> 512 MB (good balance)</li>
                  <li>• <strong>Duration:</strong> 200 ms average</li>
                  <li>• <strong>Requests:</strong> 2 million/month</li>
                  <li>• <strong>Region:</strong> us-east-1</li>
                </ul>
              </div>
              
              <div className="bg-white/80 dark:bg-gray-800 p-4 rounded-lg shadow transition-colors duration-300">
                <h4 className="font-semibold mb-3">💰 Expected Costs</h4>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>Requests:</strong> ~$0.20 (after free tier)</li>
                  <li>• <strong>Duration:</strong> ~$1.67</li>
                  <li>• <strong>Total:</strong> ~$1.87/month</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <a 
                href="/demo?memory=512&duration=200&requests=2000000&region=us-east-1" 
                className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
              >
                🧮 Try This Example
              </a>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">⭐ Next Steps</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">🔧</span>
                <h3 className="text-xl font-semibold">Advanced Configuration</h3>
              </div>
              <p className="text-gray-700 mb-4">
                Learn about all the configuration options available and how to optimize your Lambda functions.
              </p>
              <a 
                href="/configuration" 
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                View Configuration Guide →
              </a>
            </div>

            <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">💻</span>
                <h3 className="text-xl font-semibold">API & CLI Usage</h3>
              </div>
              <p className="text-gray-700 mb-4">
                Integrate the calculator into your workflows using our API, CLI, or Python package.
              </p>
              <a 
                href="/install-usage" 
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                Installation Guide →
              </a>
            </div>
          </div>
        </section>

        {/* Common Use Cases */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">🎯 Common Use Cases</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3">🌐 Web APIs</h4>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• 256-1024 MB memory</li>
                <li>• 100-500 ms duration</li>
                <li>• High request volume</li>
                <li>• Consider provisioned concurrency</li>
              </ul>
            </div>

            <div className="bg-green-50 p-6 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-3">📄 File Processing</h4>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• 1024-3008 MB memory</li>
                <li>• 1-5 seconds duration</li>
                <li>• Lower request frequency</li>
                <li>• Event-driven execution</li>
              </ul>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-3">🤖 Machine Learning</h4>
              <ul className="text-purple-700 text-sm space-y-1">
                <li>• 3008-10240 MB memory</li>
                <li>• 10-900 seconds duration</li>
                <li>• Batch processing</li>
                <li>• GPU instances for ML</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Tips for Cost Optimization */}
        <section className="mb-8">
          <h2 className="text-3xl font-semibold mb-6">💡 Cost Optimization Tips</h2>
          
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">🔥 Performance Tips</h4>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>• Right-size memory allocation</li>
                  <li>• Minimize cold starts</li>
                  <li>• Use connection pooling</li>
                  <li>• Optimize code efficiency</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">💰 Cost Tips</h4>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>• Leverage free tier limits</li>
                  <li>• Choose optimal regions</li>
                  <li>• Monitor actual usage</li>
                  <li>• Use appropriate architectures</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Get Help */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <h3 className="text-2xl font-bold mb-3">Need Help?</h3>
          <p className="text-gray-700 mb-4">
            Have questions or run into issues? We're here to help!
          </p>
          <div className="flex justify-center gap-4">
            <a 
              href="https://github.com/zmynx/aws-lambda-calculator/issues" 
              className="bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              🐛 Report Issues
            </a>
            <a 
              href="/about" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              📚 Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}