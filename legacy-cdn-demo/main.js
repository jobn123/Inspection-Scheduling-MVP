/* 巡检调度系统 MVP —— Cesium 版
 * 演示主链路：Cesium 地球 + 巡检点/充电点标注 + 禁区多边形绘制 + 模拟实时扫图
 * 生产建议：React + Resium + Zustand；坐标系用 Cesium.Transforms / 局部 ENU 对齐机器人
 */
const Cesium = window.Cesium;

// 演示中心（深圳某园区）
const ORIGIN = { lon: 114.060, lat: 22.540 };

/* ---------- 1. 初始化 Viewer（不使用 Ion token，改用 OSM 影像） ---------- */
const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.OpenStreetMapImageryProvider.fromUrl('https://tile.openstreetmap.org/')
  ),
  baseLayerPicker: false,
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: true,
  infoBox: false,
  selectionIndicator: false,
});
viewer.scene.globe.depthTestAgainstTerrain = false;
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(ORIGIN.lon, ORIGIN.lat, 6000),
});
// 屏蔽右键菜单，避免干扰禁区绘制
viewer.scene.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------- 2. 数据容器 ---------- */
const state = {
  mode: 'select',
  inspection: [],
  charging: [],
  noGo: [],
  entities: new Map(), // id -> entity
};
let idSeq = 1;

/* ---------- 3. 工具函数 ---------- */
function groundPoint(position) {
  const ray = viewer.camera.getPickRay(position);
  if (!ray) return null;
  return viewer.scene.globe.pick(ray, viewer.scene);
}
function toDegrees(cart) {
  const c = Cesium.Cartographic.fromCartesian(cart);
  return {
    lon: Cesium.Math.toDegrees(c.longitude),
    lat: Cesium.Math.toDegrees(c.latitude),
  };
}
// 局部坐标(米) -> WGS84（演示用等距近似；生产用 Cesium.Transforms.headingPitchRollToFixedFrame / ENU）
function localToLonLat(xm, ym) {
  const lat = ORIGIN.lat + ym / 111320;
  const lon = ORIGIN.lon + xm / (111320 * Math.cos((ORIGIN.lat * Math.PI) / 180));
  return [lon, lat];
}

/* ---------- 4. 标注：巡检点 / 充电点 ---------- */
const COLORS = {
  inspection: Cesium.Color.fromCssColorString('#36c5f0'),
  charging: Cesium.Color.fromCssColorString('#f5a623'),
};
function addPoint(kind, cart) {
  const d = toDegrees(cart);
  const id = 'p' + idSeq++;
  const color = COLORS[kind];
  const isInsp = kind === 'inspection';
  const name = (isInsp ? '巡检点 ' : '充电点 ') + ((isInsp ? state.inspection.length : state.charging.length) + 1);
  const entity = viewer.entities.add({
    id,
    position: cart,
    point: {
      pixelSize: 12, color, outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: name, font: '13px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -18),
      fillColor: Cesium.Color.WHITE, showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0c447c'),
    },
    properties: { kind, name, lon: d.lon.toFixed(6), lat: d.lat.toFixed(6), dwell: 30 },
  });
  state.entities.set(entity.id, entity);
  if (isInsp) state.inspection.push(entity); else state.charging.push(entity);
  renderPanel();
}

/* ---------- 5. 禁区多边形绘制 ---------- */
let drawing = false;
let vertices = [];
let preview = null;
let mousePos = null;

function startNoGo() {
  drawing = true;
  vertices = [];
  preview = viewer.entities.add({
    polyline: {
      positions: new Cesium.CallbackProperty(
        () => (vertices.length ? [...vertices, mousePos].filter(Boolean) : []), false),
      width: 2, material: Cesium.Color.RED.withAlpha(0.85), clampToGround: true,
    },
  });
}
function finishNoGo() {
  if (preview) { viewer.entities.remove(preview); preview = null; }
  if (vertices.length >= 3) {
    const pts = vertices.slice(); // 固化顶点
    const id = 'z' + idSeq++;
    const entity = viewer.entities.add({
      id,
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(pts), false),
        material: Cesium.Color.RED.withAlpha(0.22),
        outline: true, outlineColor: Cesium.Color.RED,
      },
      properties: { kind: 'noGo', name: '禁区 ' + (state.noGo.length + 1) },
    });
    state.entities.set(entity.id, entity);
    state.noGo.push(entity);
  }
  drawing = false;
  vertices = [];
  renderPanel();
}

/* ---------- 6. 交互事件 ---------- */
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

handler.setInputAction((e) => {
  if (state.mode === 'inspection' || state.mode === 'charging') {
    const cart = groundPoint(e.position);
    if (cart) addPoint(state.mode, cart);
  } else if (state.mode === 'noGo') {
    const cart = groundPoint(e.position);
    if (cart) vertices.push(cart);
  } else if (state.mode === 'select') {
    const picked = viewer.scene.pick(e.position);
    if (picked && picked.id && state.entities.has(picked.id.id)) {
      viewer.flyTo(picked.id);
    }
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

handler.setInputAction((e) => {
  mousePos = groundPoint(e.endPosition);
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

handler.setInputAction(() => { if (drawing) finishNoGo(); }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

/* ---------- 7. 模拟实时扫图（伪 WebSocket） ---------- */
let sweepTimer = null;
let robotEntity = null;
let trailEntity = null;
let trailPositions = [];
let t = 0;

function setConn(on) {
  const dot = document.querySelector('#conn .dot');
  document.getElementById('connText').textContent = on ? '实时已连接（模拟）' : '实时未连接';
  dot.classList.toggle('on', on);
}
// 模拟机器人位姿推送：覆盖路径 + 累积扫图轨迹
function fakeWebSocket() {
  return setInterval(() => {
    t += 0.03;
    const xm = 300 * Math.sin(0.7 * t);
    const ym = 220 * Math.sin(1.3 * t + Math.PI / 4);
    const [lon, lat] = localToLonLat(xm, ym);
    const cart = Cesium.Cartesian3.fromDegrees(lon, lat);
    if (!robotEntity) {
      robotEntity = viewer.entities.add({
        position: cart,
        point: { pixelSize: 14, color: Cesium.Color.LIMEGREEN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
        label: { text: '机器人', font: '13px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -20), fillColor: Cesium.Color.WHITE },
      });
      trailEntity = viewer.entities.add({
        polyline: { positions: new Cesium.CallbackProperty(() => trailPositions, false), width: 2, material: Cesium.Color.LIMEGREEN.withAlpha(0.7) },
      });
    } else {
      robotEntity.position = cart;
    }
    trailPositions.push(cart);
    if (trailPositions.length > 500) trailPositions.shift();
    setConn(true);
  }, 60);
}

/* ---------- 8. UI 绑定 ---------- */
document.getElementById('sweepBtn').addEventListener('click', (e) => {
  if (sweepTimer) {
    clearInterval(sweepTimer); sweepTimer = null;
    e.target.textContent = '▶ 实时扫图'; setConn(false);
  } else {
    sweepTimer = fakeWebSocket(); e.target.textContent = '⏸ 停止扫图';
  }
});

document.getElementById('clearBtn').addEventListener('click', () => {
  viewer.entities.removeAll();
  state.inspection = []; state.charging = []; state.noGo = []; state.entities.clear();
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
  robotEntity = null; trailEntity = null; trailPositions = []; t = 0;
  document.getElementById('sweepBtn').textContent = '▶ 实时扫图'; setConn(false);
  renderPanel();
});

const HINTS = {
  inspection: '巡检点模式：在地图上单击放置巡检点。',
  charging: '充电点模式：在地图上单击放置充电点。',
  noGo: '禁区模式：左键逐个加点，右键完成多边形。',
  select: '选择模式：点击要素列表或地图实体可飞行定位。',
};
document.querySelectorAll('.tool[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (drawing && btn.dataset.mode !== 'noGo') {
      if (preview) { viewer.entities.remove(preview); preview = null; }
      drawing = false; vertices = [];
    }
    document.querySelectorAll('.tool').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    if (state.mode === 'noGo' && !drawing) startNoGo();
    document.getElementById('hint').textContent = HINTS[state.mode];
  });
});

/* ---------- 9. 面板渲染 ---------- */
function renderPanel() {
  document.getElementById('stats').textContent =
    `巡检点 ${state.inspection.length} · 充电点 ${state.charging.length} · 禁区 ${state.noGo.length}`;

  const list = document.getElementById('entityList');
  list.innerHTML = '';
  [...state.inspection, ...state.charging, ...state.noGo].forEach((ent) => {
    const p = ent.properties;
    const kindLabel = p.kind === 'noGo' ? '禁区' : p.kind === 'charging' ? '充电' : '巡检';
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="tag ${p.kind}">${kindLabel}</span> ${p.name} ` +
      (p.lon ? `<span class="meta">${p.lon},${p.lat}</span>` : '');
    row.onclick = () => viewer.flyTo(ent);
    list.appendChild(row);
  });

  const tb = document.querySelector('#taskTable tbody');
  tb.innerHTML = '';
  let clock = 8 * 60; // 从 08:00 起排
  [...state.inspection, ...state.charging].forEach((ent) => {
    const p = ent.properties;
    const hh = String(Math.floor(clock / 60)).padStart(2, '0');
    const mm = String(clock % 60).padStart(2, '0');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.kind === 'charging' ? '充电' : '巡检'}</td><td>${hh}:${mm}</td>`;
    tb.appendChild(tr);
    clock += 25;
  });
}

renderPanel();
