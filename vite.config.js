import { defineConfig } from "vite";

const apiPort = process.env.API_PORT || "8700";

export default defineConfig({
  root: "public",
  server: {
    port: Number(process.env.VITE_DEV_PORT || 5173),
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
