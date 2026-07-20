import type { Node, Edge } from 'reactflow';
import type { FlowNodeData, FlowNodeKind, PointKind } from '../store/useStore';

export interface SeqItem {
  label: string;
  lon?: number;
  lat?: number;
  kind: FlowNodeKind;
  pointKind?: PointKind;
}

// 从 start 节点 BFS 生成任务序列（支持串行/分支）
export function buildSequence(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  points: { id: string; lon: number; lat: number; name: string; kind: string }[],
): SeqItem[] {
  const adj = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  });
  const start = nodes.find((n) => n.data.kind === 'start');
  const seq: SeqItem[] = [];
  const seen = new Set<string>();
  const first = start ? start.id : nodes[0] ? nodes[0].id : undefined;
  const stack: string[] = first ? [first] : [];
  while (stack.length) {
    const id = stack.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodes.find((x) => x.id === id);
    if (n && n.data.kind !== 'start') {
      const pt = n.data.pointId ? points.find((p) => p.id === n.data.pointId) : undefined;
      seq.push({
        label: n.data.label,
        lon: pt?.lon,
        lat: pt?.lat,
        kind: n.data.kind,
        pointKind: n.data.pointKind,
      });
    }
    (adj.get(id) || []).forEach((t) => stack.push(t));
  }
  return seq;
}

export interface SchedTask {
  id: string;
  label: string;
  kind: FlowNodeKind;
  pointKind?: PointKind;
  lon?: number;
  lat?: number;
  startMin: number;
  endMin: number;
  robot: number; // 1-based
  move: boolean;
}

export interface Schedule {
  tasks: SchedTask[];
  totalMin: number;
  robotCount: number;
}

// 每个任务的预估时长（分钟）
const DUR: Record<FlowNodeKind, number> = { start: 0, point: 20, action: 10, end: 5 };
const MOVE_DUR = 5; // 相邻任务间移动时长（演示固定值）

function durOf(t: SeqItem): number {
  if (t.kind === 'point') return t.pointKind === 'charging' ? 40 : 20;
  return DUR[t.kind];
}

// 把序列排成多机器人时间排程（round-robin 分配，每台独立时间游标）
export function buildSchedule(seq: SeqItem[], robotCount: number): Schedule {
  const rc = Math.max(1, robotCount);
  const cursors = new Array(rc).fill(0);
  const firstOnRobot = new Array(rc).fill(true);
  const tasks: SchedTask[] = [];
  seq.forEach((t, i) => {
    const r = i % rc; // 0-based
    let s = cursors[r];
    if (!firstOnRobot[r]) {
      const mEnd = s + MOVE_DUR;
      tasks.push({
        id: 'm' + i,
        label: '移动',
        kind: 'action',
        startMin: s,
        endMin: mEnd,
        robot: r + 1,
        move: true,
      });
      s = mEnd;
    }
    const e = s + durOf(t);
    tasks.push({
      id: 't' + i,
      label: t.label,
      kind: t.kind,
      pointKind: t.pointKind,
      lon: t.lon,
      lat: t.lat,
      startMin: s,
      endMin: e,
      robot: r + 1,
      move: false,
    });
    cursors[r] = e;
    firstOnRobot[r] = false;
  });
  const maxEnd = cursors.length ? Math.max(...cursors, 0) : 0;
  const total = Math.max(30, Math.ceil(maxEnd / 30) * 30);
  return { tasks, totalMin: total, robotCount: rc };
}
