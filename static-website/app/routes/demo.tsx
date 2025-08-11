import { useState } from 'react';
import type { Route } from "./+types/demo";
import axios from 'axios';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Demo - AWS Lambda Calculator" },
    { name: "description", content: "Try the AWS Lambda cost calculator" },
  ];
}

interface CalculationForm {
  memory: string;
  duration: string;
  requests: string;
  region: string;
}

export default function Demo() {
  const [formData, setFormData] = useState<CalculationForm>({
    memory: '128',
    duration: '100',
    requests: '1000000',
    region: 'us-east-1'
  });
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Replace with your actual API Gateway endpoint
      const apiEndpoint = 'https://your-api-gateway-url.amazonaws.com/prod/calculate';
      
      const res = await axios.post(apiEndpoint, {
        memory: parseInt(formData.memory),
        duration: parseInt(formData.duration),
        requests: parseInt(formData.requests),
        region: formData.region
      });
      
      setResponse(res.data.message || JSON.stringify(res.data, null, 2));
    } catch (err) {
      setError('Error: Unable to fetch data. Please check your API endpoint configuration.');
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-slate-900 dark:text-slate-100 tracking-tight">Try It Yourself</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg leading-relaxed">
        Use this calculator to estimate your AWS Lambda costs based on your function parameters.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <h2 className="text-2xl font-semibold mb-6 text-slate-900 dark:text-slate-100">Lambda Configuration</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="memory" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Memory Allocation (MB)
              </label>
              <input
                type="number"
                id="memory"
                name="memory"
                value={formData.memory}
                onChange={handleChange}
                min="128"
                max="10240"
                step="64"
                className="w-full p-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200"
                placeholder="128"
                required
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Range: 128 MB to 10,240 MB</p>
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Average Duration (milliseconds)
              </label>
              <input
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                min="1"
                max="900000"
                className="w-full p-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200"
                placeholder="100"
                required
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Maximum: 15 minutes (900,000 ms)</p>
            </div>

            <div>
              <label htmlFor="requests" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Monthly Requests
              </label>
              <input
                type="number"
                id="requests"
                name="requests"
                value={formData.requests}
                onChange={handleChange}
                min="1"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1000000"
                required
              />
            </div>

            <div>
              <label htmlFor="region" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                AWS Region
              </label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-1">US West (N. California)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">Europe (Ireland)</option>
                <option value="eu-central-1">Europe (Frankfurt)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
              }`}
            >
              {loading ? 'Calculating...' : 'Calculate Costs'}
            </button>
          </form>
        </div>

        <div className="bg-white/80 dark:bg-gray-800 p-6 rounded-lg shadow-lg transition-colors duration-300">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Results</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
              <p className="text-sm text-red-600 mt-2">
                Note: Make sure to configure your API Gateway endpoint in the demo page code.
              </p>
            </div>
          )}

          {response && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Cost Estimate</h3>
              <pre className="text-sm text-green-700 whitespace-pre-wrap">{response}</pre>
            </div>
          )}

          {!response && !error && !loading && (
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-center transition-colors duration-300">
              <p className="text-gray-600 dark:text-gray-300">
                Fill in the form and click "Calculate Costs" to see your Lambda cost estimate.
              </p>
            </div>
          )}

          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg transition-colors duration-300">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Pricing Information</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <li>• First 1M requests per month are free</li>
              <li>• $0.20 per 1M requests thereafter</li>
              <li>• GB-second pricing varies by region</li>
              <li>• Prices are rounded to the nearest cent</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}