import { create } from 'zustand';
import type { Node, Edge } from 'reactflow';

export type PointKind = 'inspection' | 'charging';
export type Mode = 'select' | 'inspection' | 'charging' | 'noGo';
export type ViewMode = 'map' | 'flow' | 'schedule';
export type FlowNodeKind = 'start' | 'point' | 'action' | 'end';
export type BaseMap = 'amapVec' | 'amapSat';

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  kind: FlowNodeKind;
  pointId?: string;
  pointKind?: PointKind;
}

export interface PointItem {
  id: string;
  kind: PointKind;
  lon: number;
  lat: number;
  name: string;
}
export interface ZoneItem {
  id: string;
  positions: [number, number][]; // [lon, lat][]
  name: string;
}

export type SceneType = 'sample' | 'tiles' | 'model';
export interface SceneItem {
  id: string;
  name: string;
  type: SceneType;
  url?: string; // 远程或本地 objectURL（tiles / model 用）
  ext?: string; // 本地文件扩展名
}

interface StoreState {
  mode: Mode;
  points: PointItem[];
  zones: ZoneItem[];
  sweepOn: boolean;
  robot: [number, number] | null;
  trail: [number, number][];
  flyTo: [number, number] | null;
  locateSample: boolean;
  scenes: SceneItem[];
  view: ViewMode;
  baseMap: BaseMap;
  flowNodes: Node<FlowNodeData>[];
  flowEdges: Edge[];
  robotCount: number;

  setMode: (m: Mode) => void;
  setBaseMap: (b: BaseMap) => void;
  addPoint: (kind: PointKind, lon: number, lat: number) => void;
  addZone: (positions: [number, number][]) => void;
  clearAll: () => void;
  setSweep: (on: boolean) => void;
  pushRobot: (pos: [number, number]) => void;
  setFlyTo: (pos: [number, number] | null) => void;
  setLocateSample: (b: boolean) => void;
  addScene: (s: Omit<SceneItem, 'id'>) => void;
  removeScene: (id: string) => void;
  setView: (v: ViewMode) => void;
  setRobotCount: (n: number) => void;
  addFlowNode: (n: Node<FlowNodeData>) => void;
  setFlow: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  clearFlow: () => void;
}

let seq = 1;

export const useStore = create<StoreState>((set) => ({
  mode: 'select',
  points: [],
  zones: [],
  sweepOn: false,
  robot: null,
  trail: [],
  flyTo: null,
  locateSample: false,
  scenes: [],
  view: 'map',
  baseMap: 'amapSat',
  flowNodes: [
    { id: 'start', type: 'flowNode', position: { x: 80, y: 140 }, data: { label: '出库起点', kind: 'start' } },
  ],
  flowEdges: [],
  robotCount: 1,

  setMode: (m) => set({ mode: m }),

  addPoint: (kind, lon, lat) =>
    set((s) => {
      const count = s.points.filter((p) => p.kind === kind).length + 1;
      const name = (kind === 'inspection' ? '巡检点 ' : '充电点 ') + count;
      return { points: [...s.points, { id: 'p' + seq++, kind, lon, lat, name }] };
    }),

  addZone: (positions) =>
    set((s) => ({
      zones: [...s.zones, { id: 'z' + seq++, positions, name: '禁区 ' + (s.zones.length + 1) }],
    })),

  clearAll: () => set({ points: [], zones: [], robot: null, trail: [], sweepOn: false, flyTo: null }),

  setSweep: (on) => set({ sweepOn: on }),

  pushRobot: (pos) => set((s) => ({ robot: pos, trail: [...s.trail, pos].slice(-500) })),

  setFlyTo: (pos) => set({ flyTo: pos }),

  setLocateSample: (b) => set({ locateSample: b }),

  addScene: (s) => set((st) => ({ scenes: [...st.scenes, { ...s, id: 'sc' + seq++ }] })),

  removeScene: (id) => set((st) => ({ scenes: st.scenes.filter((x) => x.id !== id) })),

  setView: (v) => set({ view: v }),

  setBaseMap: (b) => set({ baseMap: b }),

  setRobotCount: (n) => set({ robotCount: Math.max(1, n) }),

  addFlowNode: (n) => set((st) => ({ flowNodes: [...st.flowNodes, n] })),

  setFlow: (nodes, edges) => set({ flowNodes: nodes, flowEdges: edges }),

  clearFlow: () => set({ flowNodes: [], flowEdges: [] }),
}));
