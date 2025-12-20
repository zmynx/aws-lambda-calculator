import React from 'react';

interface Feature {
  icon: string;
  title: string;
  description: string;
  items?: string[];
}

interface FeatureGridProps {
  title?: string;
  features: Feature[];
  columns?: 2 | 3 | 4;
  variant?: 'card' | 'simple';
  className?: string;
}

export default function FeatureGrid({
  title,
  features,
  columns = 3,
  variant = 'card',
  className = ""
}: FeatureGridProps) {
  
  const gridClass = {
    2: 'grid md:grid-cols-2 gap-6',
    3: 'grid md:grid-cols-2 lg:grid-cols-3 gap-6',
    4: 'grid md:grid-cols-2 lg:grid-cols-4 gap-6'
  }[columns];

  const getFeatureContent = (feature: Feature) => {
    if (variant === 'simple') {
      return (
        <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-700 p-6 rounded-xl border border-slate-200 dark:border-slate-600 transition-colors duration-300">
          <div className="text-center">
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">{feature.title}</h3>
            <p className="text-slate-700 dark:text-slate-300 text-sm">{feature.description}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300">
        <div className="text-3xl mb-4">{feature.icon}</div>
        <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">{feature.title}</h3>
        <p className="text-slate-700 dark:text-slate-300 mb-3">{feature.description}</p>
        {feature.items && (
          <ul className="space-y-2 text-slate-700 dark:text-slate-300 text-sm">
            {feature.items.map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section className={className}>
      {title && (
        <h2 className="text-3xl font-semibold mb-8 text-slate-900 dark:text-slate-100">{title}</h2>
      )}
      <div className={gridClass}>
        {features.map((feature, index) => (
          <div key={index}>
            {getFeatureContent(feature)}
          </div>
        ))}
      </div>
    </section>
  );
}