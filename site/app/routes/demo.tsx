import { useState } from 'react';
import type { Route } from "./+types/demo";
import axios from 'axios';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Demo - AWS Lambda Calculator" },
    { name: "description", content: "Try the AWS Lambda cost calculator" },
  ];
}

interface CalculationForm {
  region: string;
  include_free_tier: boolean | string;
  architecture: string;
  number_of_requests: string;
  request_unit: string;
  duration_of_each_request_in_ms: string;
  memory: string;
  memory_unit: string;
  ephemeral_storage: string;
  storage_unit: string;
}

export default function Demo() {
  const [formData, setFormData] = useState<CalculationForm>({
    region: 'us-east-1',
    include_free_tier: true,
    architecture: 'x86',
    number_of_requests: '1000000',
    request_unit: 'Per Month',
    duration_of_each_request_in_ms: '100',
    memory: '1024',
    memory_unit: 'MB',
    ephemeral_storage: '512',
    storage_unit: 'MB'
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
      const apiEndpoint = import.meta.env.API_GATEWAY_ENDPOINT || 'http://localhost:3000/api/';
      const res = await axios.post(apiEndpoint, JSON.stringify({
        region: formData.region,
        include_free_tier: formData.include_free_tier === 'true',
        architecture: formData.architecture,
        number_of_requests: parseInt(formData.number_of_requests),
        request_unit: formData.request_unit,
        duration_of_each_request_in_ms: parseInt(formData.duration_of_each_request_in_ms),
        memory: parseInt(formData.memory),
        memory_unit: formData.memory_unit,
        ephemeral_storage: parseInt(formData.ephemeral_storage),
        storage_unit: formData.storage_unit,
      }));

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
                <option value="af-south-1">Africa (Cape Town)</option>
                <option value="ap-east-1">Asia Pacific (Hong Kong)</option>
                <option value="ap-east-2">Asia Pacific (Melbourne)</option>
                <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                <option value="ap-northeast-2">Asia Pacific (Seoul)</option>
                <option value="ap-northeast-3">Asia Pacific (Osaka)</option>
                <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                <option value="ap-south-2">Asia Pacific (Hyderabad)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                <option value="ap-southeast-3">Asia Pacific (Jakarta)</option>
                <option value="ap-southeast-4">Asia Pacific (Melbourne)</option>
                <option value="ap-southeast-5">Asia Pacific (Bangkok)</option>
                <option value="ap-southeast-7">Asia Pacific (Kuala Lumpur)</option>
                <option value="ca-central-1">Canada (Central)</option>
                <option value="ca-west-1">Canada (West)</option>
                <option value="eu-central-1">Europe (Frankfurt)</option>
                <option value="eu-central-2">Europe (Zurich)</option>
                <option value="eu-north-1">Europe (Stockholm)</option>
                <option value="eu-south-1">Europe (Milan)</option>
                <option value="eu-south-2">Europe (Spain)</option>
                <option value="eu-west-1">Europe (Ireland)</option>
                <option value="eu-west-2">Europe (London)</option>
                <option value="eu-west-3">Europe (Paris)</option>
                <option value="il-central-1">Israel (Tel Aviv)</option>
                <option value="me-central-1">Middle East (UAE)</option>
                <option value="me-south-1">Middle East (Bahrain)</option>
                <option value="mx-central-1">Mexico (Central)</option>
                <option value="sa-east-1">South America (São Paulo)</option>
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-east-2">US East (Ohio)</option>
                <option value="us-gov-east-1">US GovCloud (East)</option>
                <option value="us-gov-west-1">US GovCloud (West)</option>
                <option value="us-west-1">US West (N. California)</option>
                <option value="us-west-2">US West (Oregon)</option>

              </select>
            </div>

            <div>
              <label htmlFor="include_free_tier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Include Free Tier
              </label>
              <select
                id="include_free_tier"
                name="include_free_tier"
                value={formData.include_free_tier}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="true">Include Free Tier</option>
                <option value="false">Exclude Free Tier</option>
              </select>
            </div>

            <div>
              <label htmlFor="architecture" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Architecture
              </label>
              <select
                id="architecture"
                name="architecture"
                value={formData.architecture}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="x86">x86</option>
                <option value="arm64">ARM64</option>
              </select>
            </div>

            <div>
              <label htmlFor="number_of_requests" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Requests
              </label>
              <input
                type="number"
                id="number_of_requests"
                name="number_of_requests"
                value={formData.number_of_requests}
                onChange={handleChange}
                min="1"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1000000"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Requests per month</p>
            </div>

            <div>
              <label htmlFor="request_unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Request Unit
              </label>
              <select
                id="request_unit"
                name="request_unit"
                value={formData.request_unit}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="per second">Per Second</option>
                <option value="per minute">Per Minute</option>
                <option value="per hour">Per Hour</option>
                <option value="per day">Per Day</option>
                <option value="per month">Per Month</option>
                <option value="millions per mouth">Millions per Month</option>
              </select>
            </div>

            <div>
              <label htmlFor="duration_of_each_request_in_ms" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration of Each Request (ms)
              </label>
              <input
                type="number"
                id="duration_of_each_request_in_ms"
                name="duration_of_each_request_in_ms"
                value={formData.duration_of_each_request_in_ms}
                onChange={handleChange}
                min="1"
                max="900000"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="100"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Maximum: 15 minutes (900,000 ms)</p>
            </div>

            <div>
              <label htmlFor="memory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1024"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Range: 128 MB to 10,240 MB</p>
            </div>

            <div>
              <label htmlFor="memory_unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              </label>
              <select
                id="memory_unit"
                name="memory_unit"
                value={formData.memory_unit}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="MB">MB</option>
                <option value="GB">GB</option>
              </select>
            </div>


            <div>
              <label htmlFor="ephemeral_storage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ephemeral Storage (MB)
              </label>
              <input
                type="number"
                id="ephemeral_storage"
                name="ephemeral_storage"
                value={formData.ephemeral_storage}
                onChange={handleChange}
                min="512"
                max="10240"
                step="64"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="512"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">Range: 512 MB to 10,240 MB</p>
            </div>

            <div>
              <label htmlFor="storage_unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Storage Unit
              </label>
              <select
                id="storage_unit"
                name="storage_unit"
                value={formData.storage_unit}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="MB">MB</option>
                <option value="GB">GB</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${loading
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
