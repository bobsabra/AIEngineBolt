import { defineConfig, type ViteDevServer } from 'vite';
import { vitePlugin as remixVitePlugin, cloudflareDevProxyVitePlugin as remixCloudflareDevProxy } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import { netlifyPlugin } from "@netlify/remix-adapter/plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig((config) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      path: 'path-browserify',
    },
  },
  plugins: [
    react(),
    UnoCSS(), // 👈 Required to handle virtual:uno.css
    tsconfigPaths(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream'],
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
      protocolImports: true,
      exclude: ['child_process', 'fs'], // 'path' should not be excluded since we alias it
    }),
    bufferPolyfillPlugin(),
    remixVitePlugin({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    chrome129IssuePlugin(),
    netlifyPlugin(), // ✅ Netlify plugin should always be last
  ],
  envPrefix: [
    'VITE_',
    'OPENAI_LIKE_API_BASE_URL',
    'OLLAMA_API_BASE_URL',
    'LMSTUDIO_API_BASE_URL',
    'TOGETHER_API_BASE_URL',
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '', // 🔧 Optional: inject global SCSS if needed
      },
    },
  },
}));

function bufferPolyfillPlugin() {
  return {
    name: 'buffer-polyfill',
    transform(code: string, id: string) {
      if (id.includes('env.mjs')) {
        return {
          code: `import { Buffer } from 'buffer';\n${code}`,
          map: null,
        };
      }
      return null;
    },
  };
}

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);
        if (raw) {
          const version = parseInt(raw[2], 10);
          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );
            return;
          }
        }
        next();
      });
    },
  };
}
