import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Relative base so the static build works from any subpath (e.g. GitHub Pages).
  base: './',
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
