// 修复 vite-plugin-cesium 在「子路径 base」(如 /Inspection-Scheduling-MVP/) 下的资源错位：
// 插件会把 Cesium 静态资源复制到 dist/<base>/cesium/（多套一层 base），
// 但 HTML 里引用的却是 /<base>/cesium/Cesium.js。GitHub Pages 把 dist 根挂在 /<base>/，
// 于是线上会变成 /<base>/<base>/cesium/ 而 404（白屏）。
// 这里在构建后把错位的 dist/<base>/cesium 搬回到 dist/cesium，使路径与 HTML 引用一致。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');
const target = path.join(dist, 'cesium');

if (fs.existsSync(target)) {
  console.log('[fix-cesium-base] dist/cesium 已就位，无需移动');
  process.exit(0);
}

const entries = fs.readdirSync(dist, { withFileTypes: true }).filter((e) => e.isDirectory());
for (const e of entries) {
  const cand = path.join(dist, e.name, 'cesium');
  if (fs.existsSync(cand)) {
    fs.cpSync(cand, target, { recursive: true });
    fs.rmSync(cand, { recursive: true, force: true });
    console.log(`[fix-cesium-base] 已移动 ${path.join('dist', e.name, 'cesium')} -> dist/cesium`);
    // 顺手清理已经空的 /<base> 残留目录
    const leftover = path.join(dist, e.name);
    if (fs.existsSync(leftover) && fs.readdirSync(leftover).length === 0) {
      fs.rmSync(leftover, { recursive: true, force: true });
      console.log(`[fix-cesium-base] 已删除空残留目录 dist/${e.name}`);
    }
    process.exit(0);
  }
}

console.error('[fix-cesium-base] 未找到任何 cesium 目录，构建可能缺少 Cesium 资源');
process.exit(1);
