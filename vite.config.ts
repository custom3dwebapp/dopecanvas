import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Library build: `npm run build:lib` (or `vite build --mode lib`)
  if (mode === 'lib') {
    return {
      plugins: [
        react({ jsxRuntime: 'automatic' }),
        dts({
          include: ['src'],
          exclude: ['src/main.tsx', 'src/App.tsx'],
          rollupTypes: true,
          tsconfigPath: './tsconfig.build.json',
        }),
      ],
      build: {
        copyPublicDir: false,
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'DopeCanvas',
          formats: ['es', 'cjs'],
          fileName: (format) =>
            format === 'es' ? 'dopecanvas.js' : 'dopecanvas.cjs',
        },
        rollupOptions: {
          // Don't bundle peer dependencies
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'jsxRuntime',
            },
          },
        },
        sourcemap: true,
        // Keep a clean dist for the library
        emptyOutDir: true,
      },
    }
  }

  // Default: development app build
  return {
    plugins: [react()],
  }
})
