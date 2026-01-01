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
      build: {
        cssCodeSplit: true,
        rollupOptions: {
          output: {
            assetFileNames: 'assets/[name].[hash][extname]',
            chunkFileNames: 'assets/[name].[hash].js',
            entryFileNames: 'assets/[name].[hash].js'
          }
        }
      },
      define: {
        'process.env.YANDEX_API_KEY': JSON.stringify(env.YANDEX_API_KEY),
        'process.env.YANDEX_FOLDER_ID': JSON.stringify(env.YANDEX_FOLDER_ID),
        'process.env.YANDEX_SPEECH_KEY': JSON.stringify(env.YANDEX_SPEECH_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
