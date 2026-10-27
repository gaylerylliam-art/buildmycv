import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/.netlify/functions/cvImport": "http://127.0.0.1:8889" } },
  envPrefix: ["VITE_", "REACT_APP_"],
});
