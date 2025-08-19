import type { Route } from "./+types/configuration";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Configuration - AWS Lambda Calculator" },
    { name: "description", content: "Configuration options for AWS Lambda cost calculations" },
  ];
}

export default function Configuration() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-slate-900 dark:text-slate-100 tracking-tight">Configuration</h1>
      
      <div className="prose max-w-none">
        {/* Introduction */}
        <div className="mb-8">
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            Configure the AWS Lambda Calculator to suit your specific use case and requirements.
          </p>
        </div>

        {/* Lambda Configuration Parameters */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">🔧 Lambda Configuration Parameters</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <h3 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-300">Memory Allocation</h3>
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg transition-colors duration-300 border border-blue-100 dark:border-blue-900/30">
                  <p className="font-medium text-blue-900 dark:text-blue-200">Range: 128 MB - 10,240 MB (10 GB)</p>
                  <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">Increments of 1 MB</p>
                </div>
                <ul className="text-slate-700 dark:text-slate-300 space-y-1 text-sm leading-relaxed">
                  <li>• CPU power scales linearly with memory</li>
                  <li>• More memory = faster execution (usually)</li>
                  <li>• Cost increases with memory allocation</li>
                  <li>• Sweet spot varies by workload</li>
                </ul>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <h3 className="text-xl font-semibold mb-4 text-emerald-800 dark:text-emerald-300">Execution Duration</h3>
              <div className="space-y-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-lg transition-colors duration-300 border border-emerald-100 dark:border-emerald-900/30">
                  <p className="font-medium text-emerald-900 dark:text-emerald-200">Range: 1 ms - 900,000 ms (15 minutes)</p>
                  <p className="text-emerald-700 dark:text-emerald-300 text-sm mt-1">Billed per 1ms increments</p>
                </div>
                <ul className="text-slate-700 dark:text-slate-300 space-y-1 text-sm leading-relaxed">
                  <li>• Timeout can be set up to 15 minutes</li>
                  <li>• Cold starts add to execution time</li>
                  <li>• Optimize code for faster execution</li>
                  <li>• Consider using provisioned concurrency</li>
                </ul>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 dark:text-purple-300">Request Volume</h3>
              <div className="space-y-3">
                <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-lg transition-colors duration-300 border border-purple-100 dark:border-purple-900/30">
                  <p className="font-medium text-purple-900 dark:text-purple-200">Free Tier: 1M requests/month</p>
                  <p className="text-purple-700 dark:text-purple-300 text-sm mt-1">$0.20 per 1M requests after</p>
                </div>
                <ul className="text-slate-700 dark:text-slate-300 space-y-1 text-sm leading-relaxed">
                  <li>• First 1 million requests are free</li>
                  <li>• Additional requests charged per million</li>
                  <li>• No minimum fee or setup costs</li>
                  <li>• Pay only for what you use</li>
                </ul>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <h3 className="text-xl font-semibold mb-4 text-orange-800 dark:text-orange-300">Regional Pricing</h3>
              <div className="space-y-3">
                <div className="bg-orange-50 dark:bg-orange-950/40 p-4 rounded-lg transition-colors duration-300 border border-orange-100 dark:border-orange-900/30">
                  <p className="font-medium text-orange-900 dark:text-orange-200">Varies by AWS Region</p>
                  <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">US East (N. Virginia) typically lowest</p>
                </div>
                <ul className="text-slate-700 dark:text-slate-300 space-y-1 text-sm leading-relaxed">
                  <li>• Different regions have different costs</li>
                  <li>• Consider data transfer costs</li>
                  <li>• Latency vs cost trade-offs</li>
                  <li>• Compliance requirements</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* API Configuration */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">🚀 API Configuration</h2>
          
          <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
            <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Request Format</h3>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg mb-4 border border-slate-200 dark:border-slate-700">
              <p className="text-slate-700 dark:text-slate-300 mb-2 font-medium">The API accepts JSON payloads with the following structure:</p>
              
              <div className="bg-slate-900 dark:bg-slate-950 text-emerald-400 p-4 rounded-lg overflow-x-auto border border-slate-700 dark:border-slate-800">
                <code className="text-sm font-mono">
{`{
  "memory": 1024,           // Memory in MB (128-10240)
  "duration": 1000,         // Duration in milliseconds
  "requests": 1000000,      // Number of requests per month
  "region": "us-east-1"     // AWS region
}`}
                </code>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Supported Regions</h4>
                <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
                  <li>• us-east-1 (N. Virginia)</li>
                  <li>• us-west-1 (N. California)</li>
                  <li>• us-west-2 (Oregon)</li>
                  <li>• eu-west-1 (Ireland)</li>
                  <li>• eu-central-1 (Frankfurt)</li>
                  <li>• ap-southeast-1 (Singapore)</li>
                  <li>• ap-northeast-1 (Tokyo)</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Response Format</h4>
                <div className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
                  <code>
{`{
  "cost_breakdown": {
    "request_cost": 0.20,
    "duration_cost": 1.67,
    "total_cost": 1.87
  },
  "message": "Estimated cost..."
}`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Environment Variables */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6">🌐 Environment Variables</h2>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b">Variable</th>
                    <th className="text-left p-3 border-b">Description</th>
                    <th className="text-left p-3 border-b">Default</th>
                    <th className="text-left p-3 border-b">Required</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b font-mono bg-gray-50">API_ENDPOINT</td>
                    <td className="p-3 border-b">API Gateway endpoint URL</td>
                    <td className="p-3 border-b text-gray-500">None</td>
                    <td className="p-3 border-b">Yes</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b font-mono bg-gray-50">DEFAULT_REGION</td>
                    <td className="p-3 border-b">Default AWS region</td>
                    <td className="p-3 border-b">us-east-1</td>
                    <td className="p-3 border-b">No</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b font-mono bg-gray-50">TIMEOUT_MS</td>
                    <td className="p-3 border-b">Request timeout</td>
                    <td className="p-3 border-b">30000</td>
                    <td className="p-3 border-b">No</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b font-mono bg-gray-50">DEBUG_MODE</td>
                    <td className="p-3 border-b">Enable debug logging</td>
                    <td className="p-3 border-b">false</td>
                    <td className="p-3 border-b">No</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section className="mb-8">
          <h2 className="text-3xl font-semibold mb-6">💡 Best Practices</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Do</h3>
              <ul className="space-y-2 text-green-700">
                <li>• Test different memory configurations</li>
                <li>• Monitor actual vs estimated costs</li>
                <li>• Use appropriate timeouts</li>
                <li>• Consider cold start impacts</li>
                <li>• Optimize for both cost and performance</li>
              </ul>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-red-800 mb-3">❌ Avoid</h3>
              <ul className="space-y-2 text-red-700">
                <li>• Over-provisioning memory unnecessarily</li>
                <li>• Ignoring regional cost differences</li>
                <li>• Setting overly long timeouts</li>
                <li>• Not accounting for data transfer</li>
                <li>• Forgetting about free tier limits</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 text-center">
          <h3 className="text-2xl font-bold mb-3">Ready to optimize your Lambda costs?</h3>
          <p className="mb-4">Use our calculator with these configuration options to get accurate estimates.</p>
          <a 
            href="/demo" 
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            🧮 Start Calculating
          </a>
        </div>
      </div>
    </div>
  );
}