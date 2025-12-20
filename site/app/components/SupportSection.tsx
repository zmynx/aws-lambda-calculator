import React from 'react';
import { Link } from 'react-router';

interface SupportSectionProps {
  variant?: 'detailed' | 'simple';
  className?: string;
}

export default function SupportSection({ 
  variant = 'detailed',
  className = ""
}: SupportSectionProps) {
  
  if (variant === 'simple') {
    return (
      <div className={`bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center transition-colors duration-300 ${className}`}>
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
          <Link 
            to="/about" 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            📚 Documentation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center transition-colors duration-300 shadow-lg ${className}`}>
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
  );
}