import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/chat": "http://127.0.0.1:8008",
      "/chat_stream": "http://127.0.0.1:8008",
      "/health": "http://127.0.0.1:8008",
      "/ready": "http://127.0.0.1:8008",
      "/runtime_status": "http://127.0.0.1:8008",
      "/upload_status": "http://127.0.0.1:8008",
      "/upload_resume": "http://127.0.0.1:8008",
      "/session": "http://127.0.0.1:8008",
      "/site_content": "http://127.0.0.1:8008"
    }
  }
});
