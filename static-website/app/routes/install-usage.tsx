import type { Route } from "./+types/install-usage";
import CodeBlock from "../components/CodeBlock";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Install & Usage - AWS Lambda Calculator" },
    { name: "description", content: "How to install and use the AWS Lambda Calculator" },
  ];
}

export default function InstallUsage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">Installation & Usage</h1>
      
      <div className="prose max-w-none">
        {/* Introduction */}
        <div className="mb-8 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Multiple ways to get started with the AWS Lambda Calculator - choose what works best for your use case.
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg mb-8 transition-colors duration-300">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Choose Your Installation Method:</h3>
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

        {/* 1. Python Package */}
        <section className="mb-12" id="python-package">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">🐍</span>
            <h2 className="text-3xl font-semibold">1. Python Package</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300 mb-4">
            <div className="mb-4">
              <a
                href="https://github.com/zmynx/aws-lambda-calculator/archive/HEAD.zip"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                📥 Download
              </a>
            </div>
            
            <p className="text-gray-700 mb-4">
              Install the package using pip (@&lt;version&gt; is optional, main is latest, use a version tag for a specific version):
            </p>
            
            <CodeBlock 
              code="python -m pip install aws-lambda-calculator@git+https://github.com/zmynx/aws-lambda-calculator#egg=aws-lambda-calculator&subdirectory=aws-lambda-calculator@main"
              language="bash"
              className="mb-4"
            />
            
            <p className="text-gray-700 mb-2">Then import the package in your python code (.py):</p>
            
            <CodeBlock 
              code="import aws_lambda_calculator"
              language="python"
            />
          </div>
        </section>

        {/* 2. API */}
        <section className="mb-12" id="api">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">🚀</span>
            <h2 className="text-3xl font-semibold">2. API</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <p className="text-gray-700 mb-4">Clone the repository and install the requirements:</p>
            
            <CodeBlock 
              code={`git clone https://github.com/zMynx/aws-lambda-calculator.git
python -m pip install --requirements requirements.txt`}
              language="bash"
              className="mb-4"
            />
            
            <p className="text-gray-700 mb-2">Then run the main.py file with the required arguments:</p>
            
            <CodeBlock 
              code="python ./main.py --key=value...."
              language="bash"
            />
          </div>
        </section>

        {/* 3. CLI */}
        <section className="mb-12" id="cli">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">💻</span>
            <h2 className="text-3xl font-semibold">3. CLI</h2>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-800 shadow-lg rounded-lg p-6 transition-colors duration-300">
            <p className="text-gray-700 mb-4">Use the setup script to install the binary:</p>
            
            <CodeBlock 
              code="curl --remote-name https://github.com/zMynx/aws-lambda-calculator/blob/main/run.sh | bash -s -- --install"
              language="bash"
              className="mb-4"
            />
            
            <p className="text-gray-700 mb-2">Then run the binary with the required arguments:</p>
            
            <CodeBlock 
              code="aws-lambda-calculator --key=value...."
              language="bash"
              className="mb-4"
            />
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <p className="text-blue-700 mb-3">
                <strong>Tip:</strong> Optionally, use the alias <code className="bg-blue-100 px-1 rounded">alc</code> for the binary:
              </p>
              <CodeBlock 
                code={`alias alc=aws-lambda-calculator
alc --key=value....`}
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
    --pull \\
    --args key=value...`}
              language="bash"
            />
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
            </p>
            
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4">
              <p className="text-purple-700">
                <strong>Endpoint:</strong> <code className="bg-purple-100 px-2 py-1 rounded">https://zmynx.aws-lambda-calculator.com</code>
              </p>
            </div>
            
            <p className="text-gray-700 mb-2">Example usage (using the CLI):</p>
            
            <CodeBlock 
              code={`curl \\
    --data '{"payload":{"key":"value"}}' \\
    https://zmynx.aws-lambda-calculator.com`}
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

        {/* Report Section */}
        <section className="mb-8">
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-3 text-red-800 flex items-center">
              🐙 Report Issues
            </h3>
            <p className="text-red-700 mb-4">
              Encountered an issue? Think you've found a bug?
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/zMynx/aws-lambda-calculator/issues?q=is%3Aissue%20state%3Aclosed"
                className="text-red-600 hover:text-red-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Check closed issues
              </a>
              <a
                href="https://github.com/zMynx/aws-lambda-calculator/issues/new/choose"
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create New Issue
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}