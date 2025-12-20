import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

const CodeBlock = ({ code, language = 'bash', className = '' }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const { isDark } = useTheme();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className={`relative rounded-lg overflow-hidden transition-colors duration-300 border ${
      isDark 
        ? 'bg-slate-900/95 text-green-400 border-slate-700' 
        : 'bg-gray-900 text-green-400 border-gray-700'
    } ${className}`}>
      <div className={`flex justify-between items-center px-4 py-2 border-b transition-colors duration-300 ${
        isDark 
          ? 'bg-slate-800/90 border-slate-600' 
          : 'bg-gray-800 border-gray-700'
      }`}>
        <span className={`text-xs font-mono transition-colors duration-300 ${
          isDark ? 'text-slate-300' : 'text-gray-400'
        }`}>
          {language}
        </span>
        <button
          onClick={copyToClipboard}
          className={`flex items-center space-x-1 text-xs px-2 py-1 rounded transition-all duration-200 ${
            isDark 
              ? 'text-slate-300 hover:text-white hover:bg-slate-600' 
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {copied ? (
            <>
              <span className="text-green-400">✓</span>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <code className="text-sm whitespace-pre-wrap">{code}</code>
      </div>
    </div>
  );
};

export default CodeBlock;