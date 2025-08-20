import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AWS Lambda Calculator" },
    { name: "description", content: "Estimate AWS Lambda usage and costs" },
  ];
}

export default function Home() {
  return (
    <div className="container mx-auto p-8">
      {/* GitHub Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <a
          className="github-button bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors duration-200 font-medium shadow-md hover:shadow-lg"
          href="https://github.com/zmynx/aws-lambda-calculator"
          target="_blank"
          rel="noopener noreferrer"
        >
          ⭐ Star
        </a>
        <a
          className="github-button bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors duration-200 font-medium shadow-md hover:shadow-lg"
          href="https://github.com/zmynx/aws-lambda-calculator/fork"
          target="_blank"
          rel="noopener noreferrer"
        >
          🍴 Fork
        </a>
        <a
          className="github-button bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors duration-200 font-medium shadow-md hover:shadow-lg"
          href="https://github.com/zmynx"
          target="_blank"
          rel="noopener noreferrer"
        >
          👤 Follow @zmynx
        </a>
        <a
          className="github-button bg-pink-600 dark:bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 dark:hover:bg-pink-500 transition-colors duration-200 font-medium shadow-md hover:shadow-lg"
          href="https://github.com/sponsors/zmynx"
          target="_blank"
          rel="noopener noreferrer"
        >
          ❤️ Sponsor
        </a>
        <a
          className="github-button bg-emerald-600 dark:bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-colors duration-200 font-medium shadow-md hover:shadow-lg"
          href="https://github.com/zmynx/aws-lambda-calculator/archive/HEAD.zip"
          target="_blank"
          rel="noopener noreferrer"
        >
          📥 Download
        </a>
      </div>

      {/* Main Logo and Title */}
      <div className="text-center mb-8">
        <div className="mb-6">
          <img
            src="https://zmynx.github.io/aws-lambda-calculator/assets/IMG_0416.PNG"
            alt="AWS Lambda Calculator"
            className="mx-auto rounded-lg shadow-lg"
            style={{ height: '400px', width: '400px', border: '3px solid #e5e7eb' }}
          />
        </div>
        <h1 className="text-5xl font-bold mb-4 font-mono text-slate-900 dark:text-slate-100 tracking-tight">AWS Lambda Calculator</h1>
      </div>

      {/* Important Note */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 dark:border-blue-400 p-4 mb-8 transition-colors duration-300 rounded-r-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-blue-500 dark:text-blue-400 text-xl">ℹ️</span>
          </div>
          <div className="ml-3">
            <p className="text-blue-800 dark:text-blue-200 font-medium">
              <strong>NOTE:</strong> This project is a work in progress, and yet to be operational nor complete.
            </p>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 mb-8 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
        <h2 className="text-2xl font-semibold mb-4 flex items-center text-slate-900 dark:text-slate-100">
          📑 Table of Contents
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <ul className="space-y-2">
            <li>
              <a href="/introduction" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                📘 Introduction
              </a>
              <ul className="ml-4 mt-1 space-y-1 text-sm">
                <li>
                  <a href="/introduction#back-story" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors duration-200">
                    Back story
                  </a>
                </li>
                <li>
                  <a href="/introduction#the-short-version" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors duration-200">
                    The short version...
                  </a>
                </li>
              </ul>
            </li>
            <li>
              <a href="/install-usage" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                🚀 Installation & Usage
              </a>
              <ul className="ml-4 mt-1 space-y-1 text-sm">
                <li className="text-slate-600 dark:text-slate-400">Python Package</li>
                <li className="text-slate-600 dark:text-slate-400">API</li>
                <li className="text-slate-600 dark:text-slate-400">CLI</li>
                <li className="text-slate-600 dark:text-slate-400">Docker image</li>
                <li className="text-slate-600 dark:text-slate-400">Serverless API</li>
                <li className="text-slate-600 dark:text-slate-400">Web based solution</li>
              </ul>
            </li>
          </ul>
          <ul className="space-y-2">
            <li>
              <a href="/demo" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                🧮 Try the Calculator
              </a>
            </li>
            <li>
              <a href="https://github.com/zmynx/aws-lambda-calculator/issues" 
                 className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" target="_blank" rel="noopener noreferrer">
                🐙 Report Issues
              </a>
            </li>
            <li>
              <a href="/about" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                📄 License & Contributing
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Project Info Sections */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">📄 LICENSE</h3>
          <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
            This project is served with the Apache License.<br />
            Provided AS IS, no warranty given, no liability taken - USE AT YOUR OWN RISK.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            More info can be found in our <a href="/about" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors duration-200">LICENSE file</a>.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">🤝 CONTRIBUTING</h3>
          <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
            Shout out to:<br />
            @zMyxx @alexmachulsky @itayyosef
          </p>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Wanna contribute?<br />
            Follow our <a href="/about" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors duration-200">CONTRIBUTING guide</a> on our docs section.
          </p>
        </div>
      </div>

      {/* Show Appreciation Section */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center transition-colors duration-300 shadow-lg">
        <h3 className="text-2xl font-semibold mb-6 text-slate-900 dark:text-slate-100">💝 Show Appreciation</h3>
        <div className="flex justify-center items-center gap-6 mb-6">
          <a
            href="https://github.com/sponsors/zmynx"
            className="bg-pink-600 dark:bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 dark:hover:bg-pink-500 transition-colors duration-200 font-semibold shadow-md hover:shadow-lg"
            target="_blank"
            rel="noopener noreferrer"
          >
            ❤️ Sponsor
          </a>
          <div className="text-center">
            <img
              src="https://zmynx.github.io/aws-lambda-calculator/assets/bmc_qr.png"
              alt="Buy me a coffee QR code"
              className="mx-auto mb-2 rounded-lg"
              style={{ width: '80px', height: '80px' }}
            />
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Buy me a coffee</p>
          </div>
        </div>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
          Enjoy our projects? make sure to follow for more!<br />
          Want to keep enjoying great projects such as this? contribute to open source!
        </p>
      </div>
    </div>
  );
}
