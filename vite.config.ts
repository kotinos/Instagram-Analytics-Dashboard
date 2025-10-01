import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(async ({ command, mode }) => {
  // Use relative base in build so dist/index.html can be opened via file:// in Electron
  const base = command === 'serve' ? '/' : './';

  // During Vitest, avoid importing ESM-only plugin to prevent require() issues
  const isVitest = process.env.VITEST || mode === 'test';
  const plugins = [] as any[];
  if (!isVitest) {
    const react = (await import('@vitejs/plugin-react')).default;
    plugins.push(react());
  }

  return {
    base,
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  };
});
