import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3008,
    proxy: {
      "/api": {
        target: "https://localhost:48080",
        changeOrigin: true,
        secure: false,
      },
      "/content": {
        target: "https://localhost:48080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
