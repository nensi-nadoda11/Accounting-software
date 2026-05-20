import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) {
            return "charts";
          }

          if (id.includes("node_modules/react-hook-form") || id.includes("node_modules/@hookform/resolvers") || id.includes("node_modules/zod")) {
            return "forms";
          }

          if (id.includes("node_modules/react-router-dom")) {
            return "router";
          }

          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/axios") ||
            id.includes("node_modules/date-fns") ||
            id.includes("node_modules/lucide-react")
          ) {
            return "vendor";
          }

          return undefined;
        },
      },
    },
  },
});
