import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // 상대 경로: 정적 호스팅·Artifact 어디서든 동작
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
