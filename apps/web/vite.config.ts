import { defineConfig } from 'vite';

// Development-only origin normalization: the browser talks to Vite on :5173,
// while the API's strict CSRF check sees its own origin on :8787.
// Production must serve /api and the SPA under the same public origin.
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.origin === 'http://localhost:5173' ||
                req.headers.origin === 'http://127.0.0.1:5173') {
              proxyReq.setHeader('Origin', 'http://127.0.0.1:8787');
            }
          });
        }
      }
    }
  }
});
