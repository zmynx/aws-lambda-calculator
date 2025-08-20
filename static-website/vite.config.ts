import { defineConfig } from "vite";
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  base: mode === 'production' 
    ? "/aws-lambda-calculator/" 
    : "/",
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
}));