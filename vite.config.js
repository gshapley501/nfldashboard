import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/espn': {
        target: 'https://site.api.espn.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/espn/, ''),
      },
      '/espn-site': {
        target: 'https://site.api.espn.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/espn-site/, ''),
      }
    },
  },
});
