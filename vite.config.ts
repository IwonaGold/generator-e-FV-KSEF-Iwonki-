import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      allowedHosts: true as true,
      watch: {
        ignored: ['**/data/**', '**/data_backup/**', '**/*.json'],
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
    },
  };
});
