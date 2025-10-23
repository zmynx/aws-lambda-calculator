import React from 'react';
import { Link } from 'react-router';

interface CallToActionProps {
  variant?: 'primary' | 'secondary' | 'compact';
  title?: string;
  description?: string;
  showDemo?: boolean;
  showGettingStarted?: boolean;
  showGitHub?: boolean;
  className?: string;
}

export default function CallToAction({
  variant = 'primary',
  title,
  description,
  showDemo = true,
  showGettingStarted = true,
  showGitHub = true,
  className = ""
}: CallToActionProps) {
  
  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl p-8 text-center shadow-xl",
          title: "text-2xl font-bold mb-4",
          description: "text-lg mb-6 text-white/90",
          buttonPrimary: "bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors shadow-md",
          buttonSecondary: "bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors shadow-md",
          buttonTertiary: "bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors shadow-md"
        };
      case 'secondary':
        return {
          container: "bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 text-center",
          title: "text-2xl font-bold mb-3",
          description: "mb-4",
          buttonPrimary: "bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors",
          buttonSecondary: "bg-transparent border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors",
          buttonTertiary: "bg-slate-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-600 transition-colors"
        };
      case 'compact':
        return {
          container: "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center transition-colors duration-300",
          title: "text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100",
          description: "text-slate-700 dark:text-slate-300 mb-4",
          buttonPrimary: "bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md",
          buttonSecondary: "bg-slate-800 dark:bg-slate-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors shadow-md",
          buttonTertiary: "text-slate-800 dark:text-slate-200 px-4 py-2 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        };
    }
  };

  const styles = getStyles();
  
  const defaultTitle = variant === 'primary' 
    ? "Ready to Calculate Lambda Costs the Easy Way?"
    : variant === 'secondary'
    ? "Ready to get started?"
    : "Need Help?";
    
  const defaultDescription = variant === 'primary'
    ? "Stop wrestling with complex calculators. Get instant, accurate Lambda cost estimates."
    : variant === 'secondary'
    ? "Try our calculator or learn how to install and use it in your projects."
    : "Have questions or run into issues? We're here to help!";

  return (
    <div className={`${styles.container} ${className}`}>
      <h3 className={styles.title}>{title || defaultTitle}</h3>
      <p className={styles.description}>
        {description || defaultDescription}
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {showDemo && (
          <Link to="/demo" className={styles.buttonPrimary}>
            🧮 Try the Calculator
          </Link>
        )}
        {showGettingStarted && (
          <Link to="/getting-started" className={styles.buttonSecondary}>
            📖 Get Started
          </Link>
        )}
        {showGitHub && (
          <a 
            href="https://github.com/zmynx/aws-lambda-calculator" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.buttonTertiary}
          >
            ⭐ Star on GitHub
          </a>
        )}
      </div>
    </div>
  );
}