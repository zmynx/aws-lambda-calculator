import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { useCallback } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AWS Lambda Calculator" },
    { name: "description", content: "Estimate AWS Lambda usage and costs" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  
  const handleContributingClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // Note: Using default navigation behavior (adds history entry) so users can 
    // use back button to return to Home page after viewing contributing section
    navigate('/about', { state: { scrollTo: 'contributing' } });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-12 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          {/* GitHub Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
        <a
          className="github-button bg-slate-800 dark:bg-slate-700 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          href="https://github.com/zmynx/aws-lambda-calculator"
          target="_blank"
          rel="noopener noreferrer"
        >
          ⭐ Star
        </a>
        <a
          className="github-button bg-slate-800 dark:bg-slate-700 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          href="https://github.com/zmynx/aws-lambda-calculator/fork"
          target="_blank"
          rel="noopener noreferrer"
        >
          🍴 Fork
        </a>
        <a
          className="github-button bg-slate-800 dark:bg-slate-700 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          href="https://github.com/zmynx"
          target="_blank"
          rel="noopener noreferrer"
        >
          👤 Follow @zmynx
        </a>
        <a
          className="github-button bg-pink-600 dark:bg-pink-600 text-white px-5 py-2.5 rounded-xl hover:bg-pink-700 dark:hover:bg-pink-500 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          href="https://github.com/sponsors/zmynx"
          target="_blank"
          rel="noopener noreferrer"
        >
          ❤️ Sponsor
        </a>
        <a
          className="github-button bg-emerald-600 dark:bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          href="https://github.com/zmynx/aws-lambda-calculator/archive/HEAD.zip"
          target="_blank"
          rel="noopener noreferrer"
        >
          📥 Download
        </a>
          </div>

          {/* Main Logo and Title */}
        <div className="mb-6">
          <img
            src="https://zmynx.github.io/aws-lambda-calculator/assets/IMG_0416.PNG"
            alt="AWS Lambda Calculator"
            className="mx-auto rounded-lg shadow-lg"
            style={{ height: '400px', width: '400px', border: '3px solid #e5e7eb' }}
          />
        </div>
          <h1 className="text-5xl lg:text-6xl font-bold mb-6 font-mono text-slate-900 dark:text-slate-100 tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
            AWS Lambda Calculator
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Estimate AWS Lambda usage and costs with precision. A powerful tool for developers and architects.
          </p>
        </div>

        {/* Important Note */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 dark:border-blue-400 p-6 mb-12 transition-colors duration-300 rounded-r-xl shadow-sm">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-blue-500 dark:text-blue-400 text-xl">ℹ️</span>
          </div>
          <div className="ml-3">
            <p className="text-blue-800 dark:text-blue-200 font-medium text-lg">
              <strong>NOTE:</strong> This project is a work in progress, and yet to be operational nor complete.
            </p>
          </div>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm shadow-2xl rounded-2xl p-8 mb-12 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <h2 className="text-3xl font-bold mb-6 flex items-center text-slate-900 dark:text-slate-100">
            📑 Table of Contents
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <ul className="space-y-3">
            <li>
                <Link to="/introduction" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold text-lg transition-colors duration-200">
                  📘 Introduction
                </Link>
                <ul className="ml-6 mt-2 space-y-1.5 text-sm">
                  <li>
                    <Link to="/introduction#back-story" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors duration-200 hover:underline">
                      Back story
                    </Link>
                  </li>
                  <li>
                    <Link to="/introduction#the-short-version" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors duration-200 hover:underline">
                      The short version...
                    </Link>
                  </li>
                </ul>
            </li>
            <li>
              <Link to="/install-usage" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                🚀 Installation & Usage
              </Link>
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
              <Link to="/demo" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                🧮 Try the Calculator
              </Link>
            </li>
            <li>
              <a href="https://github.com/zmynx/aws-lambda-calculator/issues" 
                 className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" target="_blank" rel="noopener noreferrer">
                🐙 Report Issues
              </a>
            </li>
            <li>
              <a href="#" onClick={handleContributingClick} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
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
            More info can be found in our <a href="https://github.com/zmynx/aws-lambda-calculator/blob/main/LICENSE.md" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors duration-200" target="_blank" rel="noopener noreferrer">LICENSE file</a>.
          </p>
        </div>

          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm shadow-2xl rounded-2xl p-8 border border-slate-200 dark:border-slate-700 transition-all duration-300 hover:shadow-3xl hover:-translate-y-1">
            <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">🤝 CONTRIBUTING</h3>
            <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed text-base">
              Shout out to:<br />
              @zMyxx @alexmachulsky @itayyosef
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base">
              Wanna contribute?<br />
              Follow our <a href="#" onClick={handleContributingClick} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors duration-200 hover:underline">CONTRIBUTING guide</a> on our docs section.
            </p>
          </div>
      </div>

      </div>
    </div>
  );
}
