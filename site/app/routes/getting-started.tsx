import type { Route } from "./+types/install-usage";
import CodeBlock from "../components/CodeBlock";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Getting Started - AWS Lambda Calculator" },
    { name: "description", content: "Complete guide to get started with AWS Lambda Calculator - installation, usage, and examples" },
  ];
}

export default function InstallUsage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-slate-900 dark:text-slate-100 tracking-tight">Getting Started</h1>
      
      <div className="prose max-w-none">
        {/* Hero Introduction */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-8 rounded-xl border border-blue-200 dark:border-blue-800 mb-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">🚀 Start Calculating Lambda Costs in Under 2 Minutes</h2>
            <p className="text-lg text-slate-700 dark:text-slate-300 mb-4">
              Skip the complex AWS tools and get accurate Lambda cost estimates instantly. Our calculator includes all cost factors that AWS's official tools miss.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/demo" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md">
                🧮 Try Calculator Now
              </a>
              <a href="/comparison" className="bg-white text-blue-600 border border-blue-200 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md">
                📊 See Comparison
              </a>
            </div>
          </div>
        </div>

        {/* Quick Overview */}
        <div className="mb-8">
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            Multiple ways to get started with the AWS Lambda Calculator - choose what works best for your use case.
            Whether you need a quick web estimate, want to integrate into your CI/CD pipeline, or build it into your applications, we've got you covered.
          </p>
        </div>


        {/* Detailed Installation Methods */}
        <section className="mb-8">
          <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">📚 Detailed Installation Methods</h2>
          
          {/* Quick Navigation */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg mb-8 transition-colors duration-300">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Jump to Installation Method:</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <a href="#python-package" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                🐍 Python Package
              </a>
              <a href="#api" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                🚀 API
              </a>
              <a href="#cli" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                💻 CLI
              </a>
              <a href="#docker" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                🐳 Docker
              </a>
              <a href="#serverless" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                ☁️ Serverless API
              </a>
              <a href="#web" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                🌐 Web Solution
              </a>
            </div>
          </div>
        </section>

        {/* 1. Python Package */}
        <section className="mb-12" id="python-package">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">🐍</span>
            <h2 className="text-3xl font-semibold">1. Python Package</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300 mb-4">
            <div className="mb-4">
              <a
                href="https://github.com/zmynx/aws-lambda-calculator/releases"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                📥 Download
              </a>
            </div>
            
            <p className="text-gray-700 mb-4">
              Use the "Download" button to pick you desired release. Install the package via pip:
            </p>
            
            <CodeBlock 
              code="python -m pip install 'https://github.com/zmynx/aws-lambda-calculator/releases/download/${VERSION}/aws_lambda_calculator-${VERSION}-py3-none-any.whl'"
              language="bash"
              className="mb-4"
            />
            
            <p className="text-gray-700 mb-2">Then import and use the package in your Python code:</p>
            
            <CodeBlock 
              code={`from aws_lambda_calculator import calculate
from aws_lambda_calculator.models import CalculationRequest, CalculationResult

# Using the calculate function directly
result = calculate(
    region="us-east-1",
    architecture="x86",
    number_of_requests=1000000,
    request_unit="per month",
    duration_of_each_request_in_ms=1500,
    memory=128,
    memory_unit="MB",
    ephemeral_storage=512,
    storage_unit="MB",
    include_free_tier=True
)

print(f"Total cost: {result.total_cost:.6f} USD")
print("Calculation steps:")
for step in result.calculation_steps:
    print(f"  - {step}")

# Or using Pydantic models for type safety
request = CalculationRequest(
    region="us-east-1",
    architecture="arm64",
    number_of_requests=5000000,
    request_unit="per month",
    duration_of_each_request_in_ms=200,
    memory=256,
    memory_unit="MB",
    ephemeral_storage=1024,
    storage_unit="MB",
    include_free_tier=False
)

result: CalculationResult = calculate(**request.model_dump())
print(f"\nTotal monthly cost: \${result.total_cost:.2f}")`}
              language="python"
            />
          </div>
        </section>

        {/* 2. API */}
        <section className="mb-12" id="api">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">🚀</span>
            <h2 className="text-3xl font-semibold">2. API / Lambda Handler</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <p className="text-gray-700 mb-4">Clone the repository and install dependencies with Poetry:</p>
            
            <CodeBlock 
              code={`git clone https://github.com/zMynx/aws-lambda-calculator.git
cd aws-lambda-calculator
python -m poetry install`}
              language="bash"
              className="mb-4"
            />
            
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Lambda Handler Usage:</h4>
              <p className="text-gray-700 mb-2">Test the Lambda handler locally:</p>
              
              <CodeBlock 
                code={`# Create a test event file
echo '{
  "region": "us-east-1",
  "architecture": "x86",
  "number_of_requests": 1000000,
  "request_unit": "per month",
  "duration_of_each_request_in_ms": 1500,
  "memory": 128,
  "memory_unit": "MB",
  "ephemeral_storage": 512,
  "storage_unit": "MB",
  "include_free_tier": true
}' > test_event.json

# Invoke the Lambda handler wrapper
python -m poetry run python src/aws_lambda.py < test_event.json

# Or pass the event as an argument
python -m poetry run python -c "import sys; sys.path.insert(0, 'src'); from aws_lambda import handler; import json; print(json.dumps(handler(json.load(open('test_event.json')), None), indent=2))"`}
                language="bash"
              />
              
            </div>
          </div>
        </section>

        {/* 3. CLI */}
        <section className="mb-12" id="cli">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">💻</span>
            <h2 className="text-3xl font-semibold">3. CLI</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <p className="text-gray-700 mb-4">Clone the repository and install dependencies with Poetry:</p>
            
            <CodeBlock 
              code={`git clone https://github.com/zMynx/aws-lambda-calculator.git
cd aws-lambda-calculator
python -m poetry install`}
              language="bash"
              className="mb-4"
            />
            
            <p className="text-gray-700 mb-2">Then run the CLI wrapper with Poetry:</p>
            
            <CodeBlock 
              code={`# Using short flags
python -m poetry run python src/cli.py -r us-east-1 -a x86 -n 1000000 -nu 'per month' \\
  -d 1500 -m 128 -mu MB -es 512 -esu MB --free-tier true -v

# Using long flags for better readability
python -m poetry run python src/cli.py \\
  --region us-east-1 \\
  --architecture x86 \\
  --number-of-requests 1000000 \\
  --request-unit 'per month' \\
  --duration-of-each-request-in-ms 1500 \\
  --memory 128 \\
  --memory-unit MB \\
  --ephemeral-storage 512 \\
  --storage-unit MB \\
  --free-tier true \\
  --verbose`}
              language="bash"
              className="mb-4"
            />
            
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Flag Explanation:</h4>
              <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-r, --region</code>: AWS region (e.g., us-east-1, eu-west-1)</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-a, --architecture</code>: Architecture (x86 or arm64)</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-n, --number-of-requests</code>: Number of requests</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-nu, --request-unit</code>: Request unit (per second/minute/hour/day/month)</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-d, --duration-of-each-request-in-ms</code>: Duration per request in milliseconds</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-m, --memory</code>: Memory allocation</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-mu, --memory-unit</code>: Memory unit (MB or GB)</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-es, --ephemeral-storage</code>: Ephemeral storage size</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-esu, --storage-unit</code>: Storage unit (MB or GB)</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">--free-tier</code>: Include free tier (true/false, default: true)</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-v, --verbose</code>: Verbose output</li>
                <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">-V, --version</code>: Show version</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <p className="text-blue-700 mb-3">
                <strong>Tip:</strong> Create a shell alias for convenience:
              </p>
              <CodeBlock 
                code={`# Add this to your ~/.bashrc or ~/.zshrc
alias alc="cd /path/to/aws-lambda-calculator && python -m poetry run python src/cli.py"

# Then use it from anywhere
alc -r us-east-1 -a x86 -n 1000 -nu 'per second' -d 100 -m 512 -mu MB -es 512 -esu MB --free-tier false -v`}
                language="bash"
              />
            </div>
          </div>
        </section>

        {/* 4. Docker */}
        <section className="mb-12" id="docker">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">🐳</span>
            <h2 className="text-3xl font-semibold">4. Docker Image</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <div className="mb-4">
              <a
                href="https://github.com/zmynx/aws-lambda-calculator/packages"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                📦 Install Package
              </a>
            </div>
            
            <p className="text-gray-700 mb-4">
              If you wish to use the API on any platform, without installing the binary, use the docker image.
            </p>
            
            <p className="text-gray-700 mb-2">Pull the image:</p>
            
            <CodeBlock 
              code="docker pull ghcr.io/zMynx/aws-lambda-calculator:latest"
              language="bash"
              className="mb-4"
            />
            
            <p className="text-gray-700 mb-2">Then run the image with the required arguments:</p>
            
            <CodeBlock 
              code={`docker run \\
    --name aws-lambda-calculator \\
    --interactive \\
    --tty \\
    --rm \\
    ghcr.io/zmynx/aws-lambda-calculator:latest \\
    --region us-east-1 \\
    --architecture x86 \\
    --number-of-requests 1000000 \\
    --request-unit 'per month' \\
    --duration-of-each-request-in-ms 1500 \\
    --memory 128 \\
    --memory-unit MB \\
    --ephemeral-storage 512 \\
    --storage-unit MB \\
    --free-tier true \\
    --verbose`}
              language="bash"
              className="mb-6"
            />
            
            <div className="border-t pt-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">📦 Docker Compose Example</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                For more complex deployments or when you need to run the calculator as part of a service stack, 
                use Docker Compose:
              </p>
              
              <p className="text-gray-700 dark:text-gray-300 mb-2">Create a <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">compose.yaml</code> file:</p>
              
              <CodeBlock 
                code={`services:
  calculator-cli:
    image: ghcr.io/zmynx/aws-lambda-calculator:latest
    container_name: aws-lambda-calc
    platform: linux/amd64
    entrypoint: ["/usr/local/bin/python"]
    command: 
      - "cli.py"
      - "--region"
      - "us-east-1"
      - "--architecture"
      - "x86"
      - "--number-of-requests"
      - "1000000"
      - "--request-unit"
      - "per month"
      - "--duration-of-each-request-in-ms"
      - "1500"
      - "--memory"
      - "128"
      - "--memory-unit"
      - "MB"
      - "--ephemeral-storage"
      - "512"
      - "--storage-unit"
      - "MB"
      - "--free-tier"
      - "true"
      - "--verbose"

  # Or as a Lambda runtime for local testing
  calculator-lambda:
    image: ghcr.io/zmynx/aws-lambda-calculator:latest-lambda
    container_name: aws-lambda-calc-runtime
    platform: linux/amd64
    ports:
      - "9000:8080"
    environment:
      - AWS_LAMBDA_FUNCTION_TIMEOUT=30
      - AWS_LAMBDA_FUNCTION_MEMORY_SIZE=128`}
                language="yaml"
                className="mb-4"
              />
              
              <p className="text-gray-700 dark:text-gray-300 mb-2">Then run with:</p>
              
              <CodeBlock 
                code={`# Run the CLI version
docker compose run --rm calculator-cli

# Or start the Lambda runtime for testing
docker compose up calculator-lambda

# Test the Lambda runtime
curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \\
  -H "Content-Type: application/json" \\
  -d '{"region":"us-east-1","architecture":"x86","number_of_requests":1000,"request_unit":"per day","duration_of_each_request_in_ms":100,"memory":512,"memory_unit":"MB","ephemeral_storage":512,"storage_unit":"MB","include_free_tier":true}'`}
                language="bash"
              />
            </div>
          </div>
        </section>

        {/* 5. Serverless API */}
        <section className="mb-12" id="serverless">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">☁️</span>
            <h2 className="text-3xl font-semibold">5. Serverless API</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <p className="text-gray-700 mb-4">
              The serverless API solution is based on a Lambda function, and can be used by invoking the endpoint, 
              while providing a payload of the configurations to use.
              *The ednpoint my differ based on the deployment version, use the latest deployment endpoint that is published here.
            </p>
            
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4">
              <p className="text-purple-700">
                <strong>Endpoint:</strong> <code className="bg-purple-100 px-2 py-1 rounded">https://kdhtgb2u9d.execute-api.us-east-1.amazonaws.com/prod/</code>
              </p>
            </div>
            
            <p className="text-gray-700 mb-2">Example usage (using the CLI):</p>
            
            <CodeBlock 
              code={`curl \\
    --header "Content-Type: application/json" \\
    --request POST \\
    --data '{"region":"us-east-1","free_tier":"false","architecture":"x86","number_of_requests":1000,"request_unit":"per month","duration_of_each_request_in_ms":100,"memory":1024,"memory_unit":"MB","ephemeral_storage":512,"storage_unit":"MB","verbose":true}' \\
    https://kdhtgb2u9d.execute-api.us-east-1.amazonaws.com/prod/`}
              language="bash"
            />
          </div>
        </section>

        {/* 6. Web Solution */}
        <section className="mb-12" id="web">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">🌐</span>
            <h2 className="text-3xl font-semibold">6. Web Based Solution</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <p className="text-gray-700 mb-4">
              Use our web-based calculator directly in your browser - no installation required!
            </p>
            
            <div className="flex gap-4">
              <a
                href="/demo"
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-colors"
              >
                🧮 Try Calculator Now
              </a>
              <a
                href="https://github.com/zMynx/aws-lambda-calculator.io"
                className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                📁 View Source
              </a>
            </div>
          </div>
        </section>

        {/* What to Do Next */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-slate-900 dark:text-slate-100">🎯 What to Do Next</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">🔧</span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Advanced Features</h3>
              </div>
              <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm">
                Explore all parameters: regions, architectures, ephemeral storage, and free tier calculations.
              </p>
              <a href="/configuration" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                Configuration Guide →
              </a>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">💻</span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Try the Calculator</h3>
              </div>
              <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm">
                Use our web calculator to estimate costs for your Lambda functions right now.
              </p>
              <a href="/demo" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                Try Calculator →
              </a>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">📊</span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Compare Tools</h3>
              </div>
              <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm">
                See detailed comparisons with AWS's official tools and understand why ours is more accurate.
              </p>
              <a href="/comparison" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                Tool Comparison →
              </a>
            </div>
          </div>
        </section>

        {/* Need Help */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
          <h3 className="text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">Need Help?</h3>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            Have questions or run into issues? We're here to help!
          </p>
          <div className="flex justify-center gap-4">
            <a 
              href="https://github.com/zmynx/aws-lambda-calculator/issues" 
              className="bg-slate-800 dark:bg-slate-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              🐛 Report Issues
            </a>
            <a 
              href="/about" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              📚 Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
