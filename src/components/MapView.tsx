import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useStore } from '../store/useStore';
import { ORIGIN, localToLonLat } from '../utils/geo';

const INSPECT_COLOR = Cesium.Color.fromCssColorString('#36c5f0');
const CHARGE_COLOR = Cesium.Color.fromCssColorString('#f5a623');
const PREVIEW_ID = '__nogozone_preview__';

function pickGround(v: Cesium.Viewer, pos: Cesium.Cartesian2): Cesium.Cartesian3 | null {
  return v.camera.pickEllipsoid(pos, v.scene.globe.ellipsoid) ?? null;
}

function updatePreview(v: Cesium.Viewer, pts: Cesium.Cartesian3[]) {
  const existing = v.entities.getById(PREVIEW_ID);
  if (pts.length >= 2) {
    const props = {
      polyline: {
        positions: pts,
        width: 4,
        material: Cesium.Color.RED.withAlpha(0.9),
        clampToGround: true,
      },
    };
    if (existing) v.entities.remove(existing);
    v.entities.add({ id: PREVIEW_ID, ...props });
  } else if (existing) {
    v.entities.remove(existing);
  }
}

// 国内底图：高德栅格瓦片（GCJ-02 火星坐标系，无需 Key 即可访问栅格瓦片）
// 说明：高德瓦片内容采用火星坐标系，与 Cesium 默认 WGS-84 存在数十~数百米偏移；
//       作为演示底图足够用。若后续对接真实厂区坐标，需对矢量数据做 WGS-84 <-> GCJ-02 互转。
function buildAmapProviders(kind: 'amapVec' | 'amapSat'): Cesium.UrlTemplateImageryProvider[] {
  const sub = ['1', '2', '3', '4'];
  const credit = new Cesium.Credit('© 高德地图 GS(2023)0012号');
  if (kind === 'amapSat') {
    const sat = new Cesium.UrlTemplateImageryProvider({
      url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      subdomains: sub,
      maximumLevel: 18,
      credit,
    });
    const roads = new Cesium.UrlTemplateImageryProvider({
      url: 'https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8&ltype=11',
      subdomains: sub,
      maximumLevel: 18,
      credit,
    });
    return [sat, roads];
  }
  const vec = new Cesium.UrlTemplateImageryProvider({
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    subdomains: sub,
    maximumLevel: 18,
    credit,
  });
  return [vec];
}
// 示例园区的包围球（用于精确框定相机）：取园区四角地面 + 最高楼宇顶部
function sampleSphere(): Cesium.BoundingSphere {
  const ground: Cesium.Cartesian3[] = [
    [-155, -125], [155, -125], [155, 125], [-155, 125],
  ].map(([x, y]) => {
    const [lon, lat] = localToLonLat(x, y);
    return Cesium.Cartesian3.fromDegrees(lon, lat, 0);
  });
  // 抬升到最高楼宇（综合办公楼 h=48，位于 local(-90,60)）顶部上方，保证竖直方向完整
  const [tlon, tlat] = localToLonLat(-90, 60);
  ground.push(Cesium.Cartesian3.fromDegrees(tlon, tlat, 70));
  return Cesium.BoundingSphere.fromPoints(ground);
}

// 飞入示例园区：用包围球自动框定，确保整片园区居中可见
function flyToSample(v: Cesium.Viewer) {
  v.camera.flyToBoundingSphere(sampleSphere(), {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(20),
      Cesium.Math.toRadians(-32),
      470,
    ),
    duration: 1.5,
  });
}

let sampleSeeded = false;
function addSampleScene(v: Cesium.Viewer): string[] {
  const ids: string[] = [];
  const ts = () => Date.now();

  // 园区底色
  const site = [
    localToLonLat(-155, -125), localToLonLat(155, -125),
    localToLonLat(155, 125), localToLonLat(-155, 125), localToLonLat(-155, -125),
  ];
  ids.push('site-' + ts());
  v.entities.add({
    id: ids[ids.length - 1],
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArray(site.flat()),
      material: Cesium.Color.fromCssColorString('#2a2f37').withAlpha(0.55),
      outline: false,
    },
  });

  // 楼宇（命名 + 真实感高度）
  const buildings: { name: string; cx: number; cy: number; w: number; d: number; h: number; color: string }[] = [
    { name: '综合办公楼', cx: -90, cy: 60, w: 42, d: 30, h: 48, color: '#3a7bd5' },
    { name: '一号生产车间', cx: 10, cy: 72, w: 54, d: 36, h: 26, color: '#00b4d8' },
    { name: '二号生产车间', cx: 82, cy: 55, w: 46, d: 30, h: 23, color: '#00b4d8' },
    { name: '仓库A', cx: -82, cy: -42, w: 42, d: 34, h: 18, color: '#f5a623' },
    { name: '仓库B', cx: 10, cy: -46, w: 46, d: 34, h: 18, color: '#f5a623' },
    { name: '设备房', cx: 85, cy: -34, w: 26, d: 20, h: 14, color: '#ef476f' },
    { name: '门卫室', cx: 0, cy: 118, w: 14, d: 10, h: 6, color: '#8338ec' },
  ];
  buildings.forEach((b) => {
    const hw = b.w / 2, hd = b.d / 2;
    const c1 = localToLonLat(b.cx - hw, b.cy - hd);
    const c2 = localToLonLat(b.cx + hw, b.cy - hd);
    const c3 = localToLonLat(b.cx + hw, b.cy + hd);
    const c4 = localToLonLat(b.cx - hw, b.cy + hd);
    const id = 'bld-' + b.name + '-' + ts();
    v.entities.add({
      id,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([...c1, ...c2, ...c3, ...c4]),
        extrudedHeight: b.h,
        material: Cesium.Color.fromCssColorString(b.color).withAlpha(0.92),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
      label: {
        text: b.name,
        font: '13px sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -b.h - 12),
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#0c447c').withAlpha(0.9),
      },
    });
    ids.push(id);
  });

  // 围墙（矩形边框线）
  const fence = [
    localToLonLat(-150, -120), localToLonLat(150, -120),
    localToLonLat(150, 120), localToLonLat(-150, 120), localToLonLat(-150, -120),
  ];
  ids.push('fence-' + ts());
  v.entities.add({
    id: ids[ids.length - 1],
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray(fence.flat()),
      width: 2,
      material: Cesium.Color.fromCssColorString('#9aa0a6').withAlpha(0.7),
    },
  });

  // 道路（主路 + 支路）
  const roads: { id: string; pts: [number, number][] }[] = [
    { id: 'road-main', pts: [localToLonLat(-152, 0), localToLonLat(152, 0)] },
    { id: 'road-vert', pts: [localToLonLat(0, -122), localToLonLat(0, 122)] },
    { id: 'road-1', pts: [localToLonLat(-90, 30), localToLonLat(-90, 0)] },
    { id: 'road-2', pts: [localToLonLat(10, 36), localToLonLat(10, 0)] },
    { id: 'road-3', pts: [localToLonLat(82, 25), localToLonLat(82, 0)] },
    { id: 'road-4', pts: [localToLonLat(-82, -12), localToLonLat(-82, 0)] },
    { id: 'road-5', pts: [localToLonLat(10, -12), localToLonLat(10, 0)] },
    { id: 'road-6', pts: [localToLonLat(110, -80), localToLonLat(110, 0)] },
  ];
  roads.forEach((r) => {
    const id = r.id + '-' + ts();
    v.entities.add({
      id,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(r.pts.flat()),
        width: 5,
        material: Cesium.Color.fromCssColorString('#cfc7b0').withAlpha(0.7),
        clampToGround: true,
      },
    });
    ids.push(id);
  });

  // 充电桩区（地面色块）
  const pad = [
    localToLonLat(95, -95), localToLonLat(125, -95),
    localToLonLat(125, -65), localToLonLat(95, -65), localToLonLat(95, -95),
  ];
  ids.push('pad-' + ts());
  v.entities.add({
    id: ids[ids.length - 1],
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArray(pad.flat()),
      material: Cesium.Color.fromCssColorString('#1f9d55').withAlpha(0.45),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('#2ee6a6'),
    },
    label: {
      text: '充电桩区',
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0c447c').withAlpha(0.9),
    },
  });

  // 树木（绿柱）
  const trees: [number, number][] = [
    [-120, 30], [-120, -30], [120, 30], [120, -30], [-40, 100], [40, 100], [-40, -100], [40, -100],
  ];
  trees.forEach((t) => {
    const [lon, lat] = localToLonLat(t[0], t[1]);
    const id = 'tree-' + t[0] + '-' + t[1] + '-' + ts();
    v.entities.add({
      id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      cylinder: { length: 8, topRadius: 2.5, bottomRadius: 2.5, material: Cesium.Color.fromCssColorString('#2f8f4e') },
    });
    ids.push(id);
  });

  // 出库口
  const [gx, gy] = localToLonLat(0, -110);
  ids.push('gate-' + ts());
  v.entities.add({
    id: ids[ids.length - 1],
    position: Cesium.Cartesian3.fromDegrees(gx, gy),
    label: {
      text: '出库口',
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0c447c').withAlpha(0.9),
    },
  });

  // 播种巡检/充电点（仅首次），让场景即开即用
  if (!sampleSeeded) {
    const seeds: { kind: 'inspection' | 'charging'; x: number; y: number }[] = [
      { kind: 'inspection', x: -90, y: 30 },
      { kind: 'inspection', x: 10, y: 36 },
      { kind: 'inspection', x: 82, y: 25 },
      { kind: 'inspection', x: -82, y: -12 },
      { kind: 'inspection', x: 10, y: -12 },
      { kind: 'charging', x: 110, y: -80 },
    ];
    seeds.forEach((s) => {
      const [lon, lat] = localToLonLat(s.x, s.y);
      useStore.getState().addPoint(s.kind, lon, lat);
    });
    sampleSeeded = true;
  }

  // 斜视角飞入示例园区（包围球自动框定，整片园区居中可见）
  flyToSample(v);

  return ids;
}

// 相机屏幕中心对应的地面点（用于放置模型）
function cameraCenter(v: Cesium.Viewer): Cesium.Cartesian3 | null {
  const c = new Cesium.Cartesian2(v.scene.canvas.clientWidth / 2, v.scene.canvas.clientHeight / 2);
  return v.camera.pickEllipsoid(c, v.scene.globe.ellipsoid) ?? null;
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const verticesRef = useRef<Cesium.Cartesian3[]>([]);

  const points = useStore((s) => s.points);
  const zones = useStore((s) => s.zones);
  const robot = useStore((s) => s.robot);
  const trail = useStore((s) => s.trail);
  const flyTo = useStore((s) => s.flyTo);
  const locateSample = useStore((s) => s.locateSample);
  const setLocateSample = useStore((s) => s.setLocateSample);
  const mode = useStore((s) => s.mode);
  const setFlyTo = useStore((s) => s.setFlyTo);
  const scenes = useStore((s) => s.scenes);
  const baseMap = useStore((s) => s.baseMap);
  const baseLayersRef = useRef<Cesium.ImageryLayer[]>([]);

  // 挂载：原生创建 Cesium Viewer + 交互
  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: false,
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
    viewer.scene.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    viewerRef.current = viewer;
    if (import.meta.env.DEV) {
      (window as any).__viewer = viewer;
      (window as any).Cesium = Cesium;
    }

    // 默认加载示例园区（含 5 巡检点 + 1 充电点），相机随之飞入
    const st0 = useStore.getState();
    if (!st0.scenes.some((s) => s.type === 'sample')) {
      st0.addScene({ name: '示例园区', type: 'sample' });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((e: any) => {
      const m = useStore.getState().mode;
      const cart = pickGround(viewer, e.position);
      if (!cart) return;
      const c = Cesium.Cartographic.fromCartesian(cart);
      const lon = Cesium.Math.toDegrees(c.longitude);
      const lat = Cesium.Math.toDegrees(c.latitude);
      const st = useStore.getState();
      if (m === 'inspection' || m === 'charging') {
        st.addPoint(m, lon, lat);
      } else if (m === 'noGo') {
        verticesRef.current.push(cart);
        updatePreview(viewer, verticesRef.current);
      } else if (m === 'select') {
        const picked = viewer.scene.pick(e.position);
        const ent = picked && (picked as any).id;
        if (ent && typeof ent.flyTo === 'function') ent.flyTo();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((e: any) => {
      if (useStore.getState().mode !== 'noGo') return;
      const cart = pickGround(viewer, e.endPosition);
      if (cart) updatePreview(viewer, [...verticesRef.current, cart]);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      if (useStore.getState().mode === 'noGo' && verticesRef.current.length >= 3) {
        const coords = verticesRef.current.map((c) => {
          const cc = Cesium.Cartographic.fromCartesian(c);
          return [Cesium.Math.toDegrees(cc.longitude), Cesium.Math.toDegrees(cc.latitude)] as [number, number];
        });
        useStore.getState().addZone(coords);
      }
      verticesRef.current = [];
      updatePreview(viewer, []);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // ESC 取消禁区绘制：清空未完成顶点 + 预览画笔
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useStore.getState().mode === 'noGo') {
        useStore.getState().setMode('select');
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // 底图：移除旧图层并按 baseMap 重建（默认高德矢量）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    baseLayersRef.current.forEach((l) => viewer.imageryLayers.remove(l));
    baseLayersRef.current = [];
    const layers = buildAmapProviders(baseMap);
    layers.forEach((p) => baseLayersRef.current.push(viewer.imageryLayers.addImageryProvider(p)));
    if (baseLayersRef.current[0]) viewer.imageryLayers.lowerToBottom(baseLayersRef.current[0]);
    if (import.meta.env.DEV) (window as any).__baseLayers = baseLayersRef.current.length;
  }, [baseMap]);

  // 同步巡检点 / 充电点
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.values
      .filter((e) => e.id && typeof e.id === 'string' && e.id.startsWith('pt-'))
      .forEach((e) => viewer.entities.remove(e));
    points.forEach((p) => {
      viewer.entities.add({
        id: 'pt-' + p.id,
        position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
        point: {
          pixelSize: 12,
          color: p.kind === 'inspection' ? INSPECT_COLOR : CHARGE_COLOR,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: p.name,
          font: '13px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -18),
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0c447c'),
        },
      });
    });
  }, [points]);

  // 同步禁区多边形
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.values
      .filter((e) => e.id && typeof e.id === 'string' && e.id.startsWith('zn-'))
      .forEach((e) => viewer.entities.remove(e));
    zones.forEach((z) => {
      const flat = z.positions.flat();
      viewer.entities.add({
        id: 'zn-' + z.id,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
          material: Cesium.Color.RED.withAlpha(0.22),
          outline: false,
        },
      });
      // 多边形描边（Cesium 多边形 outline 恒为 1px，用独立的 polyline 画粗边）
      viewer.entities.add({
        id: 'zn-line-' + z.id,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([...flat, flat[0], flat[1]]),
          width: 4,
          material: Cesium.Color.RED.withAlpha(0.95),
          clampToGround: true,
        },
      });
    });
  }, [zones]);

  // 同步机器人 + 轨迹（remove + add，类型安全）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const robotEnt = viewer.entities.getById('robot');
    if (robot) {
      if (robotEnt) viewer.entities.remove(robotEnt);
      viewer.entities.add({
        id: 'robot',
        position: Cesium.Cartesian3.fromDegrees(robot[0], robot[1]),
        point: { pixelSize: 14, color: Cesium.Color.LIMEGREEN, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
        label: { text: '机器人', font: '13px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -20), fillColor: Cesium.Color.WHITE },
      });
    } else if (robotEnt) {
      viewer.entities.remove(robotEnt);
    }

    const trailEnt = viewer.entities.getById('trail');
    if (trailEnt) viewer.entities.remove(trailEnt);
    if (trail.length >= 2) {
      viewer.entities.add({
        id: 'trail',
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(trail.flat()),
          width: 2,
          material: Cesium.Color.LIMEGREEN.withAlpha(0.7),
        },
      });
    }
  }, [robot, trail]);

  // 侧栏点击 -> 飞行定位
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !flyTo) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(flyTo[0], flyTo[1] - 0.0022, 420),
      orientation: { heading: Cesium.Math.toRadians(20), pitch: Cesium.Math.toRadians(-24), roll: 0 },
    });
    setFlyTo(null);
  }, [flyTo, setFlyTo]);

  // 「定位到示例园区」：用包围球重新框定整片园区
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !locateSample) return;
    flyToSample(viewer);
    setLocateSample(false);
  }, [locateSample, setLocateSample]);

  // 切换离开禁区模式时，清空未完成的绘制
  useEffect(() => {
    const viewer = viewerRef.current;
    if (mode !== 'noGo' && viewer) {
      verticesRef.current = [];
      updatePreview(viewer, []);
    }
  }, [mode]);

  // 同步场景（示例 / 3D Tiles / glTF 模型），按 scenes 增删做 diff
  const sceneObjsRef = useRef<Record<string, { kind: 'entity' | 'tileset'; ids?: string[] }>>({});
  const tilesetsRef = useRef<Record<string, Cesium.Cesium3DTileset | null>>({});
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const loaded = sceneObjsRef.current;

    // 1) 移除已删除的场景
    Object.keys(loaded).forEach((id) => {
      if (!scenes.find((s) => s.id === id)) {
        const rec = loaded[id];
        if (rec.kind === 'entity' && rec.ids) {
          rec.ids.forEach((eid) => {
            const e = viewer.entities.getById(eid);
            if (e) viewer.entities.remove(e);
          });
        } else if (rec.kind === 'tileset') {
          const t = tilesetsRef.current[id];
          if (t) viewer.scene.primitives.remove(t);
          delete tilesetsRef.current[id];
        }
        delete loaded[id];
      }
    });

    // 2) 加载新增场景
    scenes.forEach((s) => {
      if (loaded[s.id]) return;
      if (s.type === 'sample') {
        loaded[s.id] = { kind: 'entity', ids: addSampleScene(viewer) };
      } else if (s.type === 'model' && s.url) {
        const center = cameraCenter(viewer) ?? Cesium.Cartesian3.fromDegrees(ORIGIN.lon, ORIGIN.lat, 0);
        const eid = 'scene-' + s.id;
        viewer.entities.add({
          id: eid,
          position: center,
          model: { uri: s.url, minimumPixelSize: 80, maximumScale: 30000 },
        });
        loaded[s.id] = { kind: 'entity', ids: [eid] };
      } else if (s.type === 'tiles' && s.url) {
        // 3D Tiles 用 fromUrl 异步加载（BIM / 倾斜摄影）
        tilesetsRef.current[s.id] = null;
        Cesium.Cesium3DTileset.fromUrl(s.url)
          .then((tileset) => {
            tilesetsRef.current[s.id] = tileset;
            if (loaded[s.id]) {
              viewer.scene.primitives.add(tileset);
              viewer.scene.camera.flyToBoundingSphere(tileset.boundingSphere);
            } else {
              viewer.scene.primitives.remove(tileset); // 加载完成前已被移除
            }
          })
          .catch(() => {
            delete tilesetsRef.current[s.id];
          });
        loaded[s.id] = { kind: 'tileset' };
      }
    });
  }, [scenes]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  );
}
