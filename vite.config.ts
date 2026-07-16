import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const allowAllHosts = env.ALLOW_ALL_HOSTS === "true";
  const configuredHosts = (env.ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  const allowedHosts: true | string[] = allowAllHosts
    ? true
    : configuredHosts;
  // Proxy dedicado -> VITE_API_URL -> Gin local (Docker BACKEND_PORT=8081)
  const proxyTarget =
    env.API_PROXY_TARGET ||
    env.VITE_API_PROXY_TARGET ||
    env.VITE_API_URL ||
    "http://localhost:8081";

  if (mode === "production" && allowAllHosts) {
    throw new Error("ALLOW_ALL_HOSTS no puede estar habilitado en produccion.");
  }

  if (mode === "production" && !allowAllHosts && configuredHosts.length === 0) {
    throw new Error(
      "ALLOWED_HOSTS debe contener al menos un host en produccion.",
    );
  }

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      allowedHosts,
      proxy: {
        // Navegador -> /api en localhost:5173 -> Vite -> ngrok o localhost (sin CORS)
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
    preview: {
      host: "0.0.0.0",
      allowedHosts,
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
