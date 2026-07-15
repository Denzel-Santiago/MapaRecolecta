import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Prioridad: proxy dedicado → VITE_API_URL → backend local
  // Por defecto Gin en Docker (recolecta_web BACKEND_PORT=8081).
  const proxyTarget =
    env.VITE_API_PROXY_TARGET || env.VITE_API_URL || "http://localhost:8081";

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      allowedHosts: [".ngrok-free.app"],
      proxy: {
        // Navegador → http://localhost:5173/api/... → Vite → backend
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              // Ngrok free bloquea con 403 (interstitial) si no va este header.
              proxyReq.setHeader("ngrok-skip-browser-warning", "1");
            });
          },
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      allowedHosts: [".ngrok-free.app"],
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("ngrok-skip-browser-warning", "1");
            });
          },
        },
      },
    },
  };
});

