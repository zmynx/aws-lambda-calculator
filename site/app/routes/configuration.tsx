import type { Route } from "./+types/configuration";
import { useState } from "react";
import FallingLambdas from "../components/FallingLambdas";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Configuration - AWS Lambda Calculator" },
    { name: "description", content: "Configuration options for AWS Lambda cost calculations" },
  ];
}

export default function Configuration() {
  const [isPrettyPrint, setIsPrettyPrint] = useState(true);
  const [isResponsePrettyPrint, setIsResponsePrettyPrint] = useState(true);
  return (
    <div className="min-h-screen relative">
      <FallingLambdas />
      <div className="container mx-auto p-8 relative z-10">
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
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl p-8 border border-slate-200/50 dark:border-slate-600 transition-colors duration-300">
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

            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl p-8 border border-slate-200/50 dark:border-slate-600 transition-colors duration-300">
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

            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl p-8 border border-slate-200/50 dark:border-slate-600 transition-colors duration-300">
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

            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl p-8 border border-slate-200/50 dark:border-slate-600 transition-colors duration-300">
              <h3 className="text-xl font-semibold mb-4 text-orange-800 dark:text-orange-300">Architecture Support</h3>
              <div className="space-y-3">
                <div className="bg-orange-50 dark:bg-orange-950/40 p-4 rounded-lg transition-colors duration-300 border border-orange-100 dark:border-orange-900/30">
                  <p className="font-medium text-orange-900 dark:text-orange-200">x86_64 & ARM64 (Graviton2)</p>
                  <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">ARM64 offers ~20% cost savings</p>
                </div>
                <ul className="text-slate-700 dark:text-slate-300 space-y-1 text-sm leading-relaxed">
                  <li>• ARM64 (Graviton2) processors for better price/performance</li>
                  <li>• x86_64 for legacy compatibility</li>
                  <li>• Different pricing tiers per architecture</li>
                  <li>• Regional pricing variations apply</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* API Configuration */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">🚀 API Configuration</h2>
          
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl p-8 border border-slate-200/50 dark:border-slate-600 transition-colors duration-300">
            <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Request Format</h3>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg mb-4 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-3">
                <p className="text-slate-700 dark:text-slate-300 font-medium">The API accepts JSON payloads with the following structure:</p>
                <button
                  onClick={() => setIsPrettyPrint(!isPrettyPrint)}
                  className="flex items-center gap-2 px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800"
                >
                  <span>{isPrettyPrint ? '📋' : '🎨'}</span>
                  {isPrettyPrint ? 'Compact' : 'Pretty Print'}
                </button>
              </div>
              
              <div className="bg-slate-900 dark:bg-slate-950 text-emerald-400 p-4 rounded-lg overflow-x-auto border border-slate-700 dark:border-slate-800">
                <code className="text-sm font-mono whitespace-pre">
                  {isPrettyPrint ? 
`{
  "region": "us-east-1",                    // AWS region (36 supported)
  "architecture": "x86_64",                 // "x86_64" or "arm64"
  "number_of_requests": 1000000,            // Number of requests
  "request_unit": "per month",              // Time unit for requests
  "duration_of_each_request_in_ms": 1500,   // Duration in milliseconds
  "memory": 128,                            // Memory in MB (128-10240)
  "memory_unit": "MB",                      // Memory unit
  "ephemeral_storage": 512,                 // Ephemeral storage in MB
  "storage_unit": "MB",                     // Storage unit
  "include_free_tier": true,                // Apply AWS free tier
  "verbose": true                           // Include calculation steps
}` : 
`{"region":"us-east-1","architecture":"x86_64","number_of_requests":1000000,"request_unit":"per month","duration_of_each_request_in_ms":1500,"memory":128,"memory_unit":"MB","ephemeral_storage":512,"storage_unit":"MB","include_free_tier":true,"verbose":true}`}
                </code>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Supported Regions (36 total)</h4>
                <div className="grid grid-cols-2 gap-1 text-blue-700 dark:text-blue-300 text-xs space-y-0">
                  <div className="space-y-1">
                    <div className="font-medium text-blue-800 dark:text-blue-200">Americas</div>
                    <div>• us-east-1 (N. Virginia)</div>
                    <div>• us-east-2 (Ohio)</div>
                    <div>• us-west-1 (N. California)</div>
                    <div>• us-west-2 (Oregon)</div>
                    <div>• ca-central-1 (Canada Central)</div>
                    <div>• ca-west-1 (Canada West)</div>
                    <div>• sa-east-1 (São Paulo)</div>
                    <div>• mx-central-1 (Mexico Central)</div>
                    <div>• us-gov-east-1 (AWS GovCloud)</div>
                    <div>• us-gov-west-1 (AWS GovCloud)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-blue-800 dark:text-blue-200">Asia Pacific</div>
                    <div>• ap-east-1 (Hong Kong)</div>
                    <div>• ap-east-2</div>
                    <div>• ap-northeast-1 (Tokyo)</div>
                    <div>• ap-northeast-2 (Seoul)</div>
                    <div>• ap-northeast-3 (Osaka)</div>
                    <div>• ap-south-1 (Mumbai)</div>
                    <div>• ap-south-2 (Hyderabad)</div>
                    <div>• ap-southeast-1 (Singapore)</div>
                    <div>• ap-southeast-2 (Sydney)</div>
                    <div>• ap-southeast-3 (Jakarta)</div>
                    <div>• ap-southeast-4 (Melbourne)</div>
                    <div>• ap-southeast-5</div>
                    <div>• ap-southeast-6</div>
                    <div>• ap-southeast-7</div>
                  </div>
                </div>
                <div className="mt-3 text-xs">
                  <div className="grid grid-cols-2 gap-1">
                    <div className="space-y-1">
                      <div className="font-medium text-blue-800 dark:text-blue-200">Europe</div>
                      <div>• eu-central-1 (Frankfurt)</div>
                      <div>• eu-central-2 (Zurich)</div>
                      <div>• eu-north-1 (Stockholm)</div>
                      <div>• eu-south-1 (Milan)</div>
                      <div>• eu-south-2 (Spain)</div>
                      <div>• eu-west-1 (Ireland)</div>
                      <div>• eu-west-2 (London)</div>
                      <div>• eu-west-3 (Paris)</div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-blue-800 dark:text-blue-200">Middle East & Africa</div>
                      <div>• af-south-1 (Cape Town)</div>
                      <div>• il-central-1 (Tel Aviv)</div>
                      <div>• me-central-1 (UAE)</div>
                      <div>• me-south-1 (Bahrain)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/40 p-4 rounded-lg border border-green-100 dark:border-green-900/30">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-green-800 dark:text-green-200">Response Format</h4>
                  <button
                    onClick={() => setIsResponsePrettyPrint(!isResponsePrettyPrint)}
                    className="flex items-center gap-2 px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors border border-green-200 dark:border-green-800"
                  >
                    <span>{isResponsePrettyPrint ? '📋' : '🎨'}</span>
                    {isResponsePrettyPrint ? 'Compact' : 'Pretty Print'}
                  </button>
                </div>
                <div className="bg-gray-900 dark:bg-gray-950 text-green-400 p-3 rounded text-xs overflow-x-auto border border-gray-700 dark:border-gray-800">
                  <code className="whitespace-pre">
                    {isResponsePrettyPrint ? 
`{
  "status": "success",                       // Response status
  "cost": 0.000417,                         // Total cost in USD
  "calculation_steps": [                    // Detailed breakdown (if verbose=true)
    "Applied AWS Free Tier benefits: 1000000 requests, 400000 GB-seconds",
    "Request cost: 1000000 requests * $0.0000002 = $0.0002",
    "Duration cost: 192 GB-seconds * $0.0000166667 = $0.000320",
    "Total cost: $0.000417"
  ]
}` : 
`{"status":"success","cost":0.000417,"calculation_steps":["Applied AWS Free Tier benefits: 1000000 requests, 400000 GB-seconds","Request cost: 1000000 requests * $0.0000002 = $0.0002","Duration cost: 192 GB-seconds * $0.0000166667 = $0.000320","Total cost: $0.000417"]}`}
                  </code>
                </div>
                <div className="mt-2 text-xs text-green-700 dark:text-green-300">
                  <p><strong>Note:</strong> <code>calculation_steps</code> array is only included when <code>verbose: true</code> is set in the request.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Free Tier Information */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">🎁 AWS Free Tier</h2>
          
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 shadow-xl rounded-xl p-6 border border-green-200 dark:border-green-800 transition-colors duration-300">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-3">Monthly Free Tier</h3>
                <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 1 million requests</li>
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 400,000 GB-seconds compute</li>
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> All AWS regions included</li>
                  <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Both x86 and ARM64 architectures</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">Pricing After Free Tier</h3>
                <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
                  <li>• Requests: $0.20 per 1M requests</li>
                  <li>• Duration: $0.0000166667 per GB-second (x86)</li>
                  <li>• Duration: $0.0000133334 per GB-second (ARM64)</li>
                  <li>• Ephemeral Storage: $0.0000000309 per GB-second</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Note:</strong> Free tier applies to the first 12 months of your AWS account and resets monthly. The calculator can optionally include or exclude free tier benefits in cost estimates.
              </p>
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
    </div>
  );
}