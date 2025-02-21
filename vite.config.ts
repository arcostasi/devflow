import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Separar React e React DOM
            'vendor-react': ['react', 'react-dom'],
            // Separar syntax highlighter (muito grande)
            'vendor-syntax': ['react-syntax-highlighter'],
            // Separar markdown
            'vendor-markdown': ['react-markdown', 'remark-gfm'],
            // Separar ícones
            'vendor-icons': ['lucide-react'],
          }
        }
      },
      // Aumentar limite de aviso para 600kB (opcional)
      chunkSizeWarningLimit: 600,
    }
  };
});
