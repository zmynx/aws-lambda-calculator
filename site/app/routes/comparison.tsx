import type { Route } from "./+types/comparison";
import { Link } from "react-router";
import FallingLambdas from "../components/FallingLambdas";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Comparison - AWS Lambda Calculator vs AWS Tools" },
    { name: "description", content: "Compare AWS Lambda Calculator with official AWS pricing tools" },
  ];
}

export default function Comparison() {
  return (
    <div className="min-h-screen relative">
      <FallingLambdas />
      <div className="container mx-auto p-8 relative z-10">
      <h1 className="text-4xl font-bold mb-6 text-slate-900 dark:text-slate-100 tracking-tight">
        AWS Lambda Calculator vs Official AWS Tools
      </h1>

      {/* Introduction */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800 mb-8">
        <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
          See how AWS Lambda Calculator compares to AWS's official pricing tools. Our solution provides a simpler, 
          faster, and more developer-friendly approach to estimating Lambda costs.
        </p>
      </div>

      {/* Quick Comparison Table */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">📊 Feature Comparison</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl rounded-xl border border-slate-200/50 dark:border-slate-600">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-700">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">Feature</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <div className="flex flex-col items-center">
                    <span className="text-green-600 dark:text-green-400">🚀 AWS Lambda Calculator</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">(Our Solution)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <div className="flex flex-col items-center">
                    <span>AWS Pricing Calculator</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">(Official)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <div className="flex flex-col items-center">
                    <span>AWS Cost Calculator</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">(Legacy)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Key Parameters Covered</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400 font-semibold">✅ Comprehensive</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">All cost drivers included</div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Very Limited</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Only 4 basic fields</div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Comprehensive</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">All parameters included</div>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">User Interface</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Intuitive & Complete</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Too Simplistic</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-orange-600 dark:text-orange-400">⚠️ Very Complex</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Cost Factors Supported</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ All Factors</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Region, arch, storage, etc.</div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Missing Critical</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">No region, arch, storage</div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ All Factors</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">API Access</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ REST API</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ No API</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ No API</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">CLI Tool</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Available</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Not Available</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Not Available</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Python Package</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ pip install</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Not Available</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Not Available</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Regional Pricing</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ All 36 Regions</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ No Region Selection</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Available</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Memory Options</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Full Range</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">128MB - 10GB</div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-orange-600 dark:text-orange-400">⚠️ Limited Dropdown</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">128MB - 2944MB only</div>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Full Range</span>
                  <div className="text-xs text-slate-600 dark:text-slate-400">128MB - 10GB</div>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Ephemeral Storage</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Supported</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Not Included</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Supported</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Architecture Selection</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ x86 & ARM64</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Not Available</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ x86 & ARM64</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Open Source</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Apache 2.0</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Proprietary</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Proprietary</span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">Offline Usage</td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-green-600 dark:text-green-400">✅ Works Offline</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Online Only</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  <span className="text-red-600 dark:text-red-400">❌ Online Only</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Visual Comparison */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">🖼️ Visual Comparison</h2>
        
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Our Tool */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4">
              <h3 className="text-xl font-semibold flex items-center">
                ✨ AWS Lambda Calculator
                <span className="ml-2 text-sm bg-white/20 px-2 py-1 rounded">Our Solution</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Key Advantages:</h4>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span><strong>Instant Results:</strong> Enter values, get costs immediately</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span><strong>Single Purpose:</strong> Built specifically for Lambda</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span><strong>Developer Friendly:</strong> CLI, API, and package options</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span><strong>No Account Required:</strong> Use immediately without AWS account</span>
                  </li>
                </ul>
              </div>
              <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                <img 
                  src="/our-calculator.png" 
                  alt="AWS Lambda Calculator - Clean Interface"
                  className="w-full h-auto rounded-lg shadow-md border border-slate-200 dark:border-slate-700"
                />
                <p className="mt-2 text-xs italic">Simple, focused interface - get results instantly</p>
              </div>
            </div>
          </div>

          {/* AWS Official Tool */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4">
              <h3 className="text-xl font-semibold flex items-center">
                🏢 AWS Lambda Pricing Calculator
                <span className="ml-2 text-sm bg-white/20 px-2 py-1 rounded">Official Tool</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Critical Limitations:</h4>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span><strong>Only 4 Basic Fields:</strong> Missing critical cost drivers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span><strong>No Region Selection:</strong> Can't get accurate regional pricing</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span><strong>No Architecture Choice:</strong> Missing ARM64 cost savings</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span><strong>No Ephemeral Storage:</strong> Ignores additional storage costs</span>
                  </li>
                </ul>
              </div>
              <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                <img 
                  src="/aws-complex-tool.png" 
                  alt="AWS Pricing Calculator - Complex Interface"
                  className="w-full h-auto rounded-lg shadow-md border border-slate-200 dark:border-slate-700"
                />
                <p className="mt-2 text-xs italic">Oversimplified tool missing essential pricing parameters</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real Calculation Example */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">📊 Real Calculation Example</h2>
        
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/30 p-6 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
          <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">📝 Test Scenario</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Lambda Configuration</h4>
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li><strong>Region:</strong> us-west-2 (Oregon)</li>
                <li><strong>Memory:</strong> 4096 MB (4 GB)</li>
                <li><strong>Architecture:</strong> ARM64 (Graviton2)</li>
                <li><strong>Executions:</strong> 1,000,000 per month</li>
                <li><strong>Duration:</strong> 2000ms per execution</li>
                <li><strong>Ephemeral Storage:</strong> 1024 MB</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Why This Matters</h4>
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>• High-memory workload (common for data processing)</li>
                <li>• ARM64 for 20% cost savings</li>
                <li>• Oregon region (different pricing)</li>
                <li>• Additional storage requirements</li>
                <li>• Real-world scale (1M executions)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Our Calculator */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border border-green-200 dark:border-green-800 overflow-hidden">
            <div className="bg-green-600 text-white p-4">
              <h3 className="text-lg font-semibold flex items-center">
                ✅ AWS Lambda Calculator
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">Our Tool</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">$101.36</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">per month</div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Compute Cost:</span>
                  <span className="font-medium">$101.33</span>
                </div>
                <div className="flex justify-between">
                  <span>Request Cost:</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage Cost:</span>
                  <span className="font-medium">$0.03</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-green-600 dark:text-green-400">
                  <span>Free Tier Savings:</span>
                  <span className="font-medium">-$5.53</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Monthly Cost:</span>
                  <span className="text-green-600 dark:text-green-400">$101.36</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <div className="text-xs text-green-800 dark:text-green-200">
                  ✓ All parameters supported<br/>
                  ✓ ARM64 pricing included<br/>
                  ✓ Regional pricing accurate<br/>
                  ✓ Ephemeral storage calculated
                </div>
              </div>
            </div>
          </div>

          {/* AWS Official Simple Calculator */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
            <div className="bg-red-600 text-white p-4">
              <h3 className="text-lg font-semibold flex items-center">
                ❌ AWS Lambda Pricing Calculator
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">Official</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">UNSUPPORTED</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">configuration</div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <span className="mr-2">⚠️</span>
                  <span>4GB memory not available in dropdown</span>
                </div>
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <span className="mr-2">⚠️</span>
                  <span>No region selection</span>
                </div>
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <span className="mr-2">⚠️</span>
                  <span>No ARM64 option</span>
                </div>
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <span className="mr-2">⚠️</span>
                  <span>No ephemeral storage</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <div className="text-xs text-red-800 dark:text-red-200 font-medium">
                  This real-world configuration cannot be calculated with AWS's official Lambda pricing tool.
                </div>
              </div>
            </div>
          </div>

          {/* AWS Legacy Calculator */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
            <div className="bg-orange-600 text-white p-4">
              <h3 className="text-lg font-semibold flex items-center">
                ⚠️ AWS Cost Calculator
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">Legacy</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">$101.36</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">per month</div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Compute Cost:</span>
                  <span className="font-medium">$101.33</span>
                </div>
                <div className="flex justify-between">
                  <span>Request Cost:</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage Cost:</span>
                  <span className="font-medium">$0.03</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-2">
                  *10+ minutes to configure<br/>
                  *Complex multi-step process<br/>
                  *No API/CLI access
                </div>
              </div>

              <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <div className="text-xs text-orange-800 dark:text-orange-200">
                  ✓ Supports all parameters<br/>
                  ❌ Extremely complex UI<br/>
                  ❌ No API/CLI access<br/>
                  ❌ Time-consuming setup
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
          <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">🔍 Key Insights</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Why AWS's Simple Calculator Fails</h4>
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>• Memory dropdown maxes out at 2944MB</li>
                <li>• Cannot handle modern high-memory workloads</li>
                <li>• Missing crucial cost factors</li>
                <li>• No regional or architectural pricing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Our Calculator's Advantage</h4>
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>• Handles any memory configuration up to 10GB</li>
                <li>• Includes ARM64 cost savings</li>
                <li>• Accurate regional pricing</li>
                <li>• All cost factors included</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Our Calculator */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">🚀 Why AWS Lambda Calculator is the Clear Choice</h2>
        
        <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-blue-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-blue-950/20 p-8 rounded-xl border border-green-200 dark:border-green-800">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100 flex items-center">
                <span className="text-2xl mr-2">✨</span>
                Superior Features
              </h3>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex items-start">
                  <span className="text-green-500 text-lg mr-2">✓</span>
                  <span><strong>Accurate Calculations:</strong> Includes ALL cost factors AWS tools miss</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 text-lg mr-2">✓</span>
                  <span><strong>36 AWS Regions:</strong> Get precise regional pricing instantly</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 text-lg mr-2">✓</span>
                  <span><strong>Architecture Comparison:</strong> See x86 vs ARM64 savings</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 text-lg mr-2">✓</span>
                  <span><strong>Developer Tools:</strong> CLI, API, Python package - use it anywhere</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 text-lg mr-2">✓</span>
                  <span><strong>Open Source:</strong> Transparent, extensible, community-driven</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100 flex items-center">
                <span className="text-2xl mr-2">⚡</span>
                Perfect For Everyone
              </h3>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex items-start">
                  <span className="text-purple-500 text-lg mr-2">•</span>
                  <span><strong>Developers:</strong> Quick estimates during development</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 text-lg mr-2">•</span>
                  <span><strong>DevOps Teams:</strong> CI/CD integration via API</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 text-lg mr-2">•</span>
                  <span><strong>Architects:</strong> Compare architectures and regions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 text-lg mr-2">•</span>
                  <span><strong>Finance Teams:</strong> Accurate budget forecasting</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 text-lg mr-2">•</span>
                  <span><strong>Startups:</strong> Optimize costs from day one</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-green-300 dark:border-green-700">
            <p className="text-center text-lg font-medium text-slate-900 dark:text-slate-100">
              🎯 <strong>Bottom Line:</strong> AWS Lambda Calculator gives you accurate, comprehensive Lambda cost estimates in seconds - 
              something the official AWS tools simply can't match.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl p-8 text-center shadow-xl">
        <h3 className="text-2xl font-bold mb-4">Ready to Calculate Lambda Costs the Easy Way?</h3>
        <p className="text-lg mb-6 text-white/90">
          Stop wrestling with complex calculators. Get instant, accurate Lambda cost estimates.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/demo" className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors shadow-md">
            🧮 Try the Calculator
          </Link>
          <Link to="/getting-started" className="bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors shadow-md">
            📖 Get Started
          </Link>
          <a href="https://github.com/zmynx/aws-lambda-calculator" target="_blank" rel="noopener noreferrer"
             className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors shadow-md">
            ⭐ Star on GitHub
          </a>
        </div>
      </div>
    </div>
    </div>
  );
}
