import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Configuración de Vite - Rodrigo Osorio v0.12 - Optimizado para performance masiva
export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss()],
    // NOTA DE SEGURIDAD: La API Key de Gemini NO debe exponerse en el cliente
    // Debe configurarse como secret en Supabase Edge Functions
    // Comando: supabase secrets set GEMINI_API_KEY=tu-api-key
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Rodrigo Osorio v0.12 - Optimizaciones de build para mejor performance
    build: {
      // Chunk splitting optimizado para mejor caching
      rollupOptions: {
        output: {
          manualChunks: {
            // Separar vendor chunks grandes
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['lucide-react', 'recharts'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'utils-vendor': ['jszip'],
          },
          // Nombres de archivos optimizados para cache
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
      // Minificación agresiva
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production', // Eliminar console.log en producción
          drop_debugger: true,
          pure_funcs: mode === 'production' ? ['console.log', 'console.info'] : [],
        },
      },
      // Límites de chunk size para mejor performance
      chunkSizeWarningLimit: 1000,
      // Source maps solo en desarrollo
      sourcemap: mode === 'development',
      // Optimización de assets
      assetsInlineLimit: 4096, // Inline assets < 4KB
    },
    // Optimizaciones de desarrollo
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        'lucide-react',
      ],
      // Pre-bundle dependencias comunes
      esbuildOptions: {
        target: 'es2022',
      },
    },
  };
});
