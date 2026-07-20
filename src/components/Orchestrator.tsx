import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore, type FlowNodeKind, type FlowNodeData } from '../store/useStore';
import { buildSequence } from '../utils/flow';

const COLORS: Record<FlowNodeKind, string> = {
  start: '#4fd99a',
  point: '#36c5f0',
  action: '#f5a623',
  end: '#ef476f',
};
const KIND_LABEL: Record<FlowNodeKind, string> = {
  start: '起点',
  point: '点位',
  action: '动作',
  end: '回库',
};
const kindLabel = (k: FlowNodeKind) => KIND_LABEL[k];
const nextId = () => 'n' + Date.now() + Math.floor(Math.random() * 1000);

function FlowNode({ data }: NodeProps<FlowNodeData>) {
  const kind = data.kind;
  return (
    <div className="rfn" style={{ borderColor: COLORS[kind] }}>
      <Handle type="target" position={Position.Top} />
      <div className="rfn-kind" style={{ background: COLORS[kind] }}>
        {kindLabel(kind)}
      </div>
      <div className="rfn-label">{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { flowNode: FlowNode };

export default function Orchestrator() {
  const points = useStore((s) => s.points);
  const flowNodes = useStore((s) => s.flowNodes);
  const flowEdges = useStore((s) => s.flowEdges);
  const addFlowNode = useStore((s) => s.addFlowNode);
  const setFlow = useStore((s) => s.setFlow);
  const clearFlow = useStore((s) => s.clearFlow);
  const setView = useStore((s) => s.setView);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setFlow(applyNodeChanges(changes, flowNodes) as Node<FlowNodeData>[], flowEdges),
    [flowNodes, flowEdges, setFlow],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setFlow(flowNodes, applyEdgeChanges(changes, flowEdges)),
    [flowNodes, flowEdges, setFlow],
  );
  const onConnect = useCallback(
    (conn: Connection) => setFlow(flowNodes, addEdge({ ...conn, animated: true }, flowEdges)),
    [flowNodes, flowEdges, setFlow],
  );

  const addNode = (kind: FlowNodeKind, label: string, extra: Partial<FlowNodeData> = {}) => {
    addFlowNode({
      id: nextId(),
      type: 'flowNode',
      position: { x: 140, y: 80 + flowNodes.length * 90 },
      data: { label, kind, ...extra },
    });
  };

  const seq = buildSequence(flowNodes, flowEdges, points);

  return (
    <div id="orch">
      <div className="orch-head">
        <button className="btn sm" onClick={() => setView('map')}>
          ← 返回地图
        </button>
        <span className="orch-title">任务编排（拖拽连线 · 选中按 Delete 删除）</span>
        <button className="btn sm" onClick={() => addNode('action', '采集数据')}>
          ＋ 采集动作
        </button>
        <button className="btn sm" onClick={() => addNode('end', '回库')}>
          ＋ 回库
        </button>
        <button className="btn sm danger" onClick={clearFlow}>
          清空
        </button>
      </div>

      <div className="orch-body">
        <div className="orch-side">
          <div className="section-title">地图点位（点击加入）</div>
          <div className="list">
            {points.length === 0 && <div className="row muted">先在地图标注点位</div>}
            {points.map((p) => (
              <div
                key={p.id}
                className="row"
                onClick={() =>
                  addNode(
                    'point',
                    p.name,
                    { pointId: p.id, pointKind: p.kind },
                  )
                }
                title="加入编排"
              >
                <span className={'tag ' + p.kind}>
                  {p.kind === 'charging' ? '充电' : '巡检'}
                </span>
                {p.name}
                <span className="meta">＋</span>
              </div>
            ))}
          </div>
        </div>

        <div className="orch-canvas">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <div className="orch-side">
          <div className="section-title">任务序列（自动生成）</div>
          <div className="list">
            {seq.length === 0 && <div className="row muted">从「出库起点」连线编排</div>}
            {seq.map((s, i) => (
              <div key={i} className="row">
                <span className="seq-no">{i + 1}</span>
                <span className={'tag ' + (s.kind === 'end' ? 'noGo' : s.kind === 'action' ? 'charging' : 'inspection')}>
                  {kindLabel(s.kind)}
                </span>
                {s.label}
                {s.lon != null && (
                  <span className="meta">
                    {s.lon.toFixed(4)},{s.lat!.toFixed(4)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
