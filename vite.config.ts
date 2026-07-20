import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  // GitHub Pages 项目页地址为 https://<user>.github.io/Inspection-Scheduling-MVP/
  // 用仓库子路径作为 base，使所有资源与 Cesium 静态目录的绝对路径都正确解析。
  base: '/Inspection-Scheduling-MVP/',
  plugins: [react(), cesium()],
  server: {
    host: true,
    port: 5173,
  },
});
