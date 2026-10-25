import { defineConfig } from 'vite';

// Development-only origin normalization: the browser talks to Vite on :5173,
// while the API's strict CSRF check sees its own origin on :8787.
// Production must serve /api and the SPA under the same public origin.
export default defineConfig({
  server: {
    allowedHosts: ['terminal.local'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.origin && new URL(req.headers.origin).host === req.headers.host) {
              proxyReq.setHeader('Origin', 'http://127.0.0.1:8787');
            }
          });
        }
      }
    }
  }
});

