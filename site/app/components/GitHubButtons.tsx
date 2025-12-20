import React from 'react';

interface GitHubButtonsProps {
  className?: string;
  layout?: 'horizontal' | 'vertical';
  showAll?: boolean;
}

export default function GitHubButtons({ 
  className = "", 
  layout = "horizontal",
  showAll = true 
}: GitHubButtonsProps) {
  const buttonClass = "github-button bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors duration-200 font-medium shadow-md hover:shadow-lg";
  const containerClass = layout === 'horizontal' 
    ? `flex flex-wrap justify-center gap-4 ${className}`
    : `flex flex-col gap-3 ${className}`;

  return (
    <div className={containerClass}>
      <a
        className={buttonClass}
        href="https://github.com/zmynx/aws-lambda-calculator"
        target="_blank"
        rel="noopener noreferrer"
      >
        ⭐ Star
      </a>
      {showAll && (
        <>
          <a
            className={buttonClass}
            href="https://github.com/zmynx/aws-lambda-calculator/fork"
            target="_blank"
            rel="noopener noreferrer"
          >
            🍴 Fork
          </a>
          <a
            className={buttonClass}
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
        </>
      )}
    </div>
  );
}