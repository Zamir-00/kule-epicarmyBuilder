import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

export default defineConfig({
    plugins: [
        TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
        react(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    base: '/v2/',
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
