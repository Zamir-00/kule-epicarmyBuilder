import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            // Proxy API calls + catalog endpoints to the apps/api dev server.
            '/api/trpc': 'http://localhost:3000',
            '/data': 'http://localhost:3000',
            '/sign-in': 'http://localhost:3000',
        },
    },
});
