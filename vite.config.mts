import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  define: {
    __ROS_VERSION__: JSON.stringify(process.env.ROS_VERSION ?? ''),
    __ROS_DISTRO__: JSON.stringify(process.env.ROS_DISTRO ?? ''),
    __ROS_PYTHON_VERSION__: JSON.stringify(process.env.ROS_PYTHON_VERSION ?? ''),
    __ROS_DOMAIN_ID__: JSON.stringify(process.env.ROS_DOMAIN_ID ?? ''),
    __RMW_IMPLEMENTATION__: JSON.stringify(process.env.RMW_IMPLEMENTATION ?? ''),
    __ROS_LOCALHOST_ONLY__: JSON.stringify(process.env.ROS_LOCALHOST_ONLY ?? ''),
    __ROS_AUTOMATIC_DISCOVERY_RANGE__: JSON.stringify(process.env.ROS_AUTOMATIC_DISCOVERY_RANGE ?? ''),
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
