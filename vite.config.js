// @ts-check

const buildStamp = new Date().toISOString();
const cacheBust = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Vite config for the browser assembly app.
 *
 * @type {import("vite").UserConfig}
 */
export default {
  define: {
    __AEROBEAT_BUILD_STAMP__: JSON.stringify(buildStamp),
    __AEROBEAT_CACHE_BUST__: JSON.stringify(cacheBust)
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false
  }
};
