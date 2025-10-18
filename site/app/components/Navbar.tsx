// app/components/Navbar.tsx
import { Link } from 'react-router';
import ThemeToggle from './ThemeToggle';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 shadow-xl border-b border-slate-200 dark:border-slate-700/50 transition-colors duration-300 backdrop-blur-sm">
      <div className="container mx-auto">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link to="/" className="text-xl font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
              <img src="/logo.svg" alt="Lambda Calculator" className="w-8 h-8 inline mr-2" /> Lambda Calculator
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <ul className="flex flex-wrap space-x-4 lg:space-x-6">
              <li><Link to="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">Home</Link></li>
              <li><Link to="/introduction" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">Introduction</Link></li>
              <li><Link to="/install-usage" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">Install & Usage</Link></li>
              <li><Link to="/configuration" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">Configuration</Link></li>
              <li><Link to="/getting-started" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">Getting Started</Link></li>
              <li><Link to="/api-docs" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">API Docs</Link></li>
              <li><Link to="/demo" className="hover:text-white dark:hover:text-white bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 px-4 py-2 rounded-lg font-semibold transition-colors duration-200 shadow-md">Demo</Link></li>
              <li><Link to="/about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">About</Link></li>
            </ul>
            <div className="ml-4 pl-4 border-l border-slate-300 dark:border-slate-600">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
