import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'dopecanvas/style.css': resolve(__dirname, 'src/dopecanvas.css'),
      dopecanvas: resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
