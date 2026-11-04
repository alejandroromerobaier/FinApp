import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';

// Read version and git commit metadata
let packageVersion = '2.7.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
  if (pkg.version) packageVersion = pkg.version;
} catch {
  // fallback if read fails
}

let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // fallback if git is unavailable
}

const buildDate = new Date().toISOString();

const createVersionJsonPlugin = (versionData: Record<string, unknown>): Plugin => ({
  name: 'generate-version-json',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify(versionData, null, 2),
    });
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/version.json') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(versionData));
        return;
      }
      next();
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const appEnv = mode === 'production' ? 'PROD' : mode.toUpperCase();

  const versionPayload = {
    version: packageVersion,
    commit: commitHash,
    buildDate,
    env: appEnv,
  };

  return {
    plugins: [react(), tailwindcss(), createVersionJsonPlugin(versionPayload)],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      __APP_VERSION__: JSON.stringify(packageVersion),
      __COMMIT_HASH__: JSON.stringify(commitHash),
      __BUILD_DATE__: JSON.stringify(buildDate),
      __APP_ENV__: JSON.stringify(appEnv),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'vendor-pdf';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
